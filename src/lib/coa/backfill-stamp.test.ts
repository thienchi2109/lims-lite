import { describe, expect, it } from 'vitest'

import { patchCoAStampHtml } from '../../../scripts/backfill-coa-stamp.mjs'

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
    expect(result.html).toContain('left: -36px;')
    expect(result.html).toContain('z-index: 2;')
  })

  it('skips HTML that already contains the manager stamp marker', () => {
    const stampedHtml = createLegacyCoAHtml().replace(
      '</body>',
      '<img data-coa-stamp="manager" /></body>',
    )

    const result = patchCoAStampHtml(stampedHtml, STAMP_SRC)

    expect(result).toEqual({
      html: stampedHtml,
      patched: false,
      reason: 'already_stamped',
    })
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
