import { describe, expect, it } from 'vitest'

import { getCoAStampDataUri } from './stamp'

describe('getCoAStampDataUri', () => {
  it('loads the approved SVG stamp as a data URI', async () => {
    const dataUri = await getCoAStampDataUri()

    expect(dataUri).toMatch(/^data:image\/svg\+xml;base64,/)

    const encodedSvg = dataUri.replace('data:image/svg+xml;base64,', '')
    const svgMarkup = Buffer.from(encodedSvg, 'base64').toString('utf8')

    expect(svgMarkup).toContain('<svg')
    expect(svgMarkup).toContain('TRUNG TÂM KIỂM SOÁT BỆNH TẬT')
    expect(svgMarkup).toContain('filter="url(#ink-texture)"')
  })
})
