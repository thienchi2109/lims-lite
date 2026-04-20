#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const MANAGER_STAMP_MARKER = 'data-coa-stamp="manager"'

const MANAGER_STAMP_STYLES = `
        .manager-signature-stack { position: relative; width: 220px; min-height: 80px; margin: -88px auto 8px auto; }
        .manager-signature-image { margin: 0 auto 8px auto; position: relative; z-index: 1; }
        .manager-stamp-image {
            position: absolute; left: -66px; top: 50%; transform: translateY(-50%);
            width: 150px; height: auto; z-index: 2; pointer-events: none;
        }`

function addManagerStampStyles(html) {
  if (html.includes('.manager-stamp-image')) {
    return html
  }

  if (html.includes('</style>')) {
    return html.replace('</style>', `${MANAGER_STAMP_STYLES}\n  </style>`)
  }

  return html.replace(
    '</head>',
    `<style>${MANAGER_STAMP_STYLES}\n  </style>\n</head>`,
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

function parseArgs(argv) {
  const apply = argv.includes('--apply')
  const dryRun = argv.includes('--dry-run') || !apply
  const limitIndex = argv.indexOf('--limit')
  const limit = limitIndex === -1 ? null : Number.parseInt(argv[limitIndex + 1], 10)

  return {
    apply,
    dryRun,
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
  }
}

async function loadStampDataUri() {
  const stampPath = join(process.cwd(), 'public', 'Stamp.png')
  const stampBytes = await readFile(stampPath)
  return `data:image/png;base64,${stampBytes.toString('base64')}`
}

function createSupabaseAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function sha256(value) {
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

async function backfillReport({ supabase, report, stampDataUri, dryRun }) {
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

  if (!patch.patched) {
    return {
      id: report.id,
      filePath: report.file_path,
      patched: false,
      reason: patch.reason,
    }
  }

  const fileHash = sha256(patch.html)

  if (dryRun) {
    return {
      id: report.id,
      filePath: report.file_path,
      patched: true,
      reason: 'dry_run',
      fileHash,
    }
  }

  const { error: uploadError } = await supabase.storage
    .from('coa-reports')
    .upload(report.file_path, patch.html, {
      contentType: 'text/html',
      upsert: true,
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

  const { error: updateError } = await supabase
    .from('coa_reports')
    .update({
      file_hash: fileHash,
    })
    .eq('id', report.id)

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
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
