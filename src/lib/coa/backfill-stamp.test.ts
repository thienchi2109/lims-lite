import { describe, expect, it } from 'vitest'

import {
  backfillReport,
  parseArgs,
  patchCoAStampHtml,
  sha256,
} from '../../../scripts/backfill-coa-stamp.mjs'

const STAMP_SRC = 'data:image/png;base64,stamp-data'

function createLegacyCoAHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    .signature-image { max-width: 200px; max-height: 80px; display: block; margin: -88px auto 8px auto; }
  </style>
</head>
<body>
  <div class="sig-col">
    <div class="sig-date">Cần Thơ, ngày 20 tháng 04 năm 2026</div>
    <div class="sig-title">Lãnh đạo khoa Xét nghiệm</div>
    <img src="data:image/png;base64,manager-signature" alt="Chữ ký" class="signature-image" />
    <div class="sig-name">Nguyễn Quản Lý</div>
  </div>
</body>
</html>
`
}

describe('patchCoAStampHtml', () => {
  it('injects manager stamp markup and overlay styles into legacy CoA HTML', () => {
    const result = patchCoAStampHtml(createLegacyCoAHtml(), STAMP_SRC)

    expect(result).toEqual(
      expect.objectContaining({
        patched: true,
        reason: 'patched',
      }),
    )
    expect(result.html).toContain('class="manager-signature-stack"')
    expect(result.html).toContain(
      '<img src="data:image/png;base64,stamp-data" alt="Con dấu" class="manager-stamp-image" data-coa-stamp="manager" />',
    )
    expect(result.html).toContain('class="signature-image manager-signature-image"')
    expect(result.html).toContain('.manager-stamp-image {')
    expect(result.html).toContain('left: -156px;')
    expect(result.html).toContain('width: 240px;')
    expect(result.html).toContain('z-index: 2;')
  })

  it('skips HTML that already contains the manager stamp marker', () => {
    const stampedHtml = patchCoAStampHtml(createLegacyCoAHtml(), STAMP_SRC).html

    const result = patchCoAStampHtml(stampedHtml, STAMP_SRC)

    expect(result).toEqual({
      html: stampedHtml,
      patched: false,
      reason: 'already_stamped',
    })
  })

  it('refreshes manager stamp styles in already stamped CoA HTML', () => {
    const oldStampedHtml = patchCoAStampHtml(createLegacyCoAHtml(), STAMP_SRC)
      .html.replace('left: -156px;', 'left: -66px;')
      .replace('width: 240px;', 'width: 150px;')

    const result = patchCoAStampHtml(oldStampedHtml, STAMP_SRC)

    expect(result).toEqual(
      expect.objectContaining({
        patched: true,
        reason: 'styles_refreshed',
      }),
    )
    expect(result.html).toContain('left: -156px;')
    expect(result.html).toContain('width: 240px;')
    expect(result.html).not.toContain('left: -66px;')
    expect(result.html).not.toContain('width: 150px;')
  })

  it('skips HTML when the manager signature block cannot be identified', () => {
    const result = patchCoAStampHtml('<html><body>No manager block</body></html>', STAMP_SRC)

    expect(result).toEqual({
      html: '<html><body>No manager block</body></html>',
      patched: false,
      reason: 'manager_signature_not_found',
    })
  })
})

describe('parseArgs', () => {
  it('requires explicit confirmation before applying updates to ready CoAs', () => {
    expect(() => parseArgs(['--apply'])).toThrow('--allow-ready-update')
    expect(parseArgs(['--apply', '--allow-ready-update'])).toEqual({
      apply: true,
      dryRun: false,
      limit: null,
      allowReadyUpdate: true,
    })
  })

  it('rejects missing or invalid limit values', () => {
    expect(() => parseArgs(['--limit'])).toThrow('Invalid --limit value')
    expect(() => parseArgs(['--limit', 'abc'])).toThrow('Invalid --limit value')
    expect(() => parseArgs(['--limit', '0'])).toThrow('Invalid --limit value')
  })
})

type FakeSupabaseOptions = {
  html: string
  updateError?: { message: string } | null
}

function createFakeSupabase(options: FakeSupabaseOptions) {
  const uploads: Array<{ filePath: string; html: string }> = []
  const updates: Array<{ file_hash: string }> = []

  const supabase = {
    storage: {
      from: () => ({
        download: async () => ({
          data: {
            text: async () => options.html,
          },
          error: null,
        }),
        upload: async (filePath: string, html: string) => {
          uploads.push({ filePath, html })
          return { error: null }
        },
      }),
    },
    from: () => ({
      update: (payload: { file_hash: string }) => {
        updates.push(payload)
        return {
          eq: async () => ({ error: options.updateError ?? null }),
        }
      },
    }),
  }

  return { supabase, uploads, updates }
}

describe('backfillReport', () => {
  it('syncs metadata when retrying an already stamped file with a stale hash', async () => {
    const stampedHtml = patchCoAStampHtml(createLegacyCoAHtml(), STAMP_SRC).html
    const { supabase, uploads, updates } = createFakeSupabase({ html: stampedHtml })

    const result = await backfillReport({
      supabase,
      report: {
        id: 'coa-1',
        file_path: 'sample/1.html',
        file_hash: 'stale-hash',
      },
      stampDataUri: STAMP_SRC,
      dryRun: false,
    })

    expect(result).toEqual(
      expect.objectContaining({
        patched: true,
        reason: 'metadata_synced',
        fileHash: sha256(stampedHtml),
      }),
    )
    expect(uploads).toEqual([])
    expect(updates).toEqual([{ file_hash: sha256(stampedHtml) }])
  })

  it('rolls back storage content when metadata update fails after upload', async () => {
    const legacyHtml = createLegacyCoAHtml()
    const { supabase, uploads } = createFakeSupabase({
      html: legacyHtml,
      updateError: { message: 'permission denied' },
    })

    const result = await backfillReport({
      supabase,
      report: {
        id: 'coa-1',
        file_path: 'sample/1.html',
        file_hash: 'old-hash',
      },
      stampDataUri: STAMP_SRC,
      dryRun: false,
    })

    expect(result).toEqual(
      expect.objectContaining({
        patched: false,
        reason: 'metadata_update_failed',
        rollbackAttempted: true,
      }),
    )
    expect(uploads).toHaveLength(2)
    expect(uploads[1]).toEqual({
      filePath: 'sample/1.html',
      html: legacyHtml,
    })
  })
})
