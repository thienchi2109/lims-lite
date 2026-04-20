import { describe, expect, it } from 'vitest'

import { getCoAStampDataUri } from './stamp'

describe('getCoAStampDataUri', () => {
  it('loads the transparent PNG stamp as a data URI', async () => {
    const dataUri = await getCoAStampDataUri()

    expect(dataUri).toMatch(/^data:image\/png;base64,/)

    const encodedPng = dataUri.replace('data:image/png;base64,', '')
    const pngBytes = Buffer.from(encodedPng, 'base64')

    expect([...pngBytes.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
  })
})
