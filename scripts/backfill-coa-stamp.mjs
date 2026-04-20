#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const MANAGER_STAMP_MARKER = 'data-coa-stamp="manager"'

const MANAGER_STAMP_STYLES = `
        .manager-signature-stack { position: relative; width: 220px; min-height: 80px; margin: -88px auto 8px auto; }
        .manager-signature-image { margin: 0 auto 8px auto; position: relative; z-index: 1; }
        .manager-stamp-image {
            position: absolute; left: -156px; top: 50%; transform: translateY(-50%);
            width: 240px; height: auto; z-index: 2; pointer-events: none;
        }`

const MANAGER_STAMP_STYLES_PATTERN =
  /\.manager-signature-stack\s*\{[^}]*\}\s*\.manager-signature-image\s*\{[^}]*\}\s*\.manager-stamp-image\s*\{[^}]*\}/

function normalizeStyleBlock(value) {
  return value.replaceAll(/\s+/g, ' ').trim()
}

function addManagerStampStyles(html) {
  const existingStyles = html.match(MANAGER_STAMP_STYLES_PATTERN)?.[0]

  if (existingStyles) {
    if (normalizeStyleBlock(existingStyles) === normalizeStyleBlock(MANAGER_STAMP_STYLES)) {
      return html
    }

    return html.replace(MANAGER_STAMP_STYLES_PATTERN, MANAGER_STAMP_STYLES.trimStart())
  }

  if (html.includes('</style>')) {
    return html.replace('</style>', `${MANAGER_STAMP_STYLES}\n  </style>`)
  }

  return html.replace(
    '</head>',
    `<style>${MANAGER_STAMP_STYLES}\n  </style>\n</head>`,
  )
}

function refreshManagerStampSrc(html, managerStampSrc) {
  return html.replace(
    /<img\b(?=[^>]*class="manager-stamp-image")(?=[^>]*data-coa-stamp="manager")[^>]*\/>/,
    (tag) => tag.replace(/src="[^"]+"/, `src="${managerStampSrc}"`),
  )
}

function addManagerSignatureClass(signatureImageHtml) {
  return signatureImageHtml.replace(
    'class="signature-image"',
    'class="signature-image manager-signature-image"',
  )
}

export function patchCoAStampHtml(html, managerStampSrc) {
  if (html.includes(MANAGER_STAMP_MARKER)) {
    const refreshedHtml = addManagerStampStyles(refreshManagerStampSrc(html, managerStampSrc))

    if (refreshedHtml !== html) {
      const reason = refreshedHtml.includes(managerStampSrc) && !html.includes(managerStampSrc)
        ? 'stamp_refreshed'
        : 'styles_refreshed'

      return { html: refreshedHtml, patched: true, reason }
    }

    return { html, patched: false, reason: 'already_stamped' }
  }

  const managerSignaturePattern =
    /(<div class="sig-title">Lãnh đạo khoa Xét nghiệm<\/div>\s*)(<img\b(?=[^>]*alt="Chữ ký")(?=[^>]*class="signature-image")[^>]*\/>)/

  if (!managerSignaturePattern.test(html)) {
    return { html, patched: false, reason: 'manager_signature_not_found' }
  }

  const stampedHtml = html.replace(
    managerSignaturePattern,
    (_match, titleHtml, signatureImageHtml) => {
      const managerSignatureHtml = addManagerSignatureClass(signatureImageHtml)

      return `${titleHtml}<div class="manager-signature-stack">
                    ${managerSignatureHtml}
                    <img src="${managerStampSrc}" alt="Con dấu" class="manager-stamp-image" data-coa-stamp="manager" />
                </div>`
    },
  )

  return {
    html: addManagerStampStyles(stampedHtml),
    patched: true,
    reason: 'patched',
  }
}

export function parseArgs(argv) {
  const apply = argv.includes('--apply')
  const dryRun = argv.includes('--dry-run') || !apply
  const allowReadyUpdate = argv.includes('--allow-ready-update')
  const limitIndex = argv.indexOf('--limit')
  let limit = null

  if (limitIndex !== -1) {
    const rawLimit = argv[limitIndex + 1]
    const parsedLimit = Number.parseInt(rawLimit ?? '', 10)

    if (!rawLimit || !/^[1-9]\d*$/.test(rawLimit) || !Number.isFinite(parsedLimit)) {
      throw new Error(`Invalid --limit value: ${JSON.stringify(rawLimit)}`)
    }

    limit = parsedLimit
  }

  if (apply && !allowReadyUpdate) {
    throw new Error(
      'Applying updates to ready CoAs requires --allow-ready-update. Use dry-run first.',
    )
  }

  return {
    apply,
    dryRun,
    limit,
    allowReadyUpdate,
  }
}

async function loadStampDataUri() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const stampPath = join(scriptDir, '..', 'public', 'Stamp.svg')
  const stampBytes = await readFile(stampPath)
  return `data:image/svg+xml;base64,${stampBytes.toString('base64')}`
}

export function resolveServiceRoleKey(env = process.env) {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || null
}

function createSupabaseAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = resolveServiceRoleKey()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY',
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

async function fetchReadyCoAReports(supabase, limit) {
  let query = supabase
    .from('coa_reports')
    .select('id, sample_id, file_path, file_hash, version')
    .eq('status', 'ready')
    .is('deleted_at', null)
    .order('generated_at', { ascending: true })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch CoA reports: ${error.message}`)
  }

  return data || []
}

async function updateReportHash({ supabase, reportId, fileHash }) {
  return supabase
    .from('coa_reports')
    .update({
      file_hash: fileHash,
    })
    .eq('id', reportId)
}

async function uploadReportHtml({ supabase, filePath, html }) {
  return supabase.storage
    .from('coa-reports')
    .upload(filePath, html, {
      contentType: 'text/html',
      upsert: true,
    })
}

export async function backfillReport({ supabase, report, stampDataUri, dryRun }) {
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('coa-reports')
    .download(report.file_path)

  if (downloadError || !fileData) {
    return {
      id: report.id,
      filePath: report.file_path,
      patched: false,
      reason: 'download_failed',
      error: downloadError?.message || 'No file data returned',
    }
  }

  const originalHtml = await fileData.text()
  const patch = patchCoAStampHtml(originalHtml, stampDataUri)
  const fileHash = sha256(patch.html)

  if (!patch.patched) {
    if (patch.reason === 'already_stamped' && report.file_hash !== fileHash) {
      if (dryRun) {
        return {
          id: report.id,
          filePath: report.file_path,
          patched: true,
          reason: 'metadata_sync_dry_run',
          fileHash,
        }
      }

      const { error: updateError } = await updateReportHash({
        supabase,
        reportId: report.id,
        fileHash,
      })

      if (updateError) {
        return {
          id: report.id,
          filePath: report.file_path,
          patched: false,
          reason: 'metadata_update_failed',
          error: updateError.message,
        }
      }

      return {
        id: report.id,
        filePath: report.file_path,
        patched: true,
        reason: 'metadata_synced',
        fileHash,
      }
    }

    return {
      id: report.id,
      filePath: report.file_path,
      patched: false,
      reason: patch.reason,
    }
  }

  if (dryRun) {
    return {
      id: report.id,
      filePath: report.file_path,
      patched: true,
      reason: 'dry_run',
      fileHash,
    }
  }

  const { error: uploadError } = await uploadReportHtml({
    supabase,
    filePath: report.file_path,
    html: patch.html,
  })

  if (uploadError) {
    return {
      id: report.id,
      filePath: report.file_path,
      patched: false,
      reason: 'upload_failed',
      error: uploadError.message,
    }
  }

  const { error: updateError } = await updateReportHash({
    supabase,
    reportId: report.id,
    fileHash,
  })

  if (updateError) {
    const { error: rollbackError } = await uploadReportHtml({
      supabase,
      filePath: report.file_path,
      html: originalHtml,
    })

    return {
      id: report.id,
      filePath: report.file_path,
      patched: false,
      reason: 'metadata_update_failed',
      error: updateError.message,
      rollbackAttempted: true,
      rollbackError: rollbackError?.message,
    }
  }

  return {
    id: report.id,
    filePath: report.file_path,
    patched: true,
    reason: 'patched',
    fileHash,
  }
}

function summarize(results) {
  return results.reduce(
    (summary, result) => {
      summary.scanned += 1

      if (result.patched) {
        summary.patched += 1
      } else if (result.reason === 'already_stamped') {
        summary.skippedAlreadyStamped += 1
      } else if (result.reason === 'manager_signature_not_found') {
        summary.skippedMissingManagerBlock += 1
      } else {
        summary.failed += 1
      }

      return summary
    },
    {
      scanned: 0,
      patched: 0,
      skippedAlreadyStamped: 0,
      skippedMissingManagerBlock: 0,
      failed: 0,
    },
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const supabase = createSupabaseAdminClient()
  const stampDataUri = await loadStampDataUri()
  const reports = await fetchReadyCoAReports(supabase, args.limit)
  const results = []

  for (const report of reports) {
    results.push(
      await backfillReport({
        supabase,
        report,
        stampDataUri,
        dryRun: args.dryRun,
      }),
    )
  }

  console.log(
    JSON.stringify(
      {
        mode: args.dryRun ? 'dry-run' : 'apply',
        summary: summarize(results),
        results,
      },
      null,
      2,
    ),
  )
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] || '').href

if (isDirectRun) {
  try {
    await main()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
