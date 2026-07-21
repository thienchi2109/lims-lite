import { describe, expect, it } from 'vitest'

import { formatSampleQuality } from './sample-quality-display'

describe('formatSampleQuality', () => {
    it.each([
        [true, 'Đạt'],
        [false, 'Không đạt'],
        [null, 'Chưa đánh giá'],
    ] as const)('formats %s as %s', (sampleQuality, expectedLabel) => {
        expect(formatSampleQuality(sampleQuality)).toBe(expectedLabel)
    })
})
