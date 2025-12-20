/**
 * Unit tests for Reports Dashboard utility functions
 * Tests for calculateTATInHours, calculateOnTimeRate, formatTrendIndicator
 */

import { describe, it, expect } from 'vitest'
import {
  calculateTATInHours,
  calculateOnTimeRate,
  formatTrendIndicator,
} from './utils-reports'

describe('calculateTATInHours', () => {
  it('should calculate TAT correctly for valid dates', () => {
    const receivedAt = '2024-12-20T08:00:00Z'
    const completedAt = '2024-12-21T08:00:00Z'

    const tat = calculateTATInHours(receivedAt, completedAt)

    expect(tat).toBe(24) // 24 hours
  })

  it('should calculate TAT for dates with different formats', () => {
    const receivedAt = new Date('2024-12-20T10:00:00Z')
    const completedAt = new Date('2024-12-20T14:30:00Z')

    const tat = calculateTATInHours(receivedAt, completedAt)

    expect(tat).toBe(4.5) // 4.5 hours
  })

  it('should return null if receivedAt is missing', () => {
    const tat = calculateTATInHours(null, '2024-12-21T08:00:00Z')

    expect(tat).toBeNull()
  })

  it('should return null if completedAt is missing', () => {
    const tat = calculateTATInHours('2024-12-20T08:00:00Z', null)

    expect(tat).toBeNull()
  })

  it('should return null if both dates are missing', () => {
    const tat = calculateTATInHours(null, null)

    expect(tat).toBeNull()
  })

  it('should handle very short TAT (less than 1 hour)', () => {
    const receivedAt = '2024-12-20T08:00:00Z'
    const completedAt = '2024-12-20T08:30:00Z'

    const tat = calculateTATInHours(receivedAt, completedAt)

    expect(tat).toBe(0.5) // 30 minutes = 0.5 hours
  })

  it('should handle very long TAT (over 100 hours)', () => {
    const receivedAt = '2024-12-01T08:00:00Z'
    const completedAt = '2024-12-06T08:00:00Z'

    const tat = calculateTATInHours(receivedAt, completedAt)

    expect(tat).toBe(120) // 5 days = 120 hours
  })
})

describe('calculateOnTimeRate', () => {
  it('should return 100% when all samples are on-time (within SLA)', () => {
    const samples = [
      { tatHours: 24 },
      { tatHours: 48 },
      { tatHours: 70 },
    ]

    const rate = calculateOnTimeRate(samples, 72)

    expect(rate).toBe(100)
  })

  it('should return 0% when all samples are late', () => {
    const samples = [
      { tatHours: 80 },
      { tatHours: 90 },
      { tatHours: 100 },
    ]

    const rate = calculateOnTimeRate(samples, 72)

    expect(rate).toBe(0)
  })

  it('should return 0% when there are 0 samples', () => {
    const samples: Array<{ tatHours: number | null }> = []

    const rate = calculateOnTimeRate(samples, 72)

    expect(rate).toBe(0)
  })

  it('should calculate correct percentage for mixed samples', () => {
    const samples = [
      { tatHours: 24 }, // on-time
      { tatHours: 48 }, // on-time
      { tatHours: 80 }, // late
      { tatHours: 90 }, // late
    ]

    const rate = calculateOnTimeRate(samples, 72)

    expect(rate).toBe(50) // 2 out of 4 = 50%
  })

  it('should handle samples at exact SLA threshold', () => {
    const samples = [
      { tatHours: 72 }, // exactly on SLA
      { tatHours: 24 }, // on-time
    ]

    const rate = calculateOnTimeRate(samples, 72)

    expect(rate).toBe(100) // Both on-time (72 <= 72)
  })

  it('should ignore samples with null TAT', () => {
    const samples = [
      { tatHours: 24 }, // on-time
      { tatHours: null }, // ignored
      { tatHours: 48 }, // on-time
      { tatHours: 80 }, // late
    ]

    const rate = calculateOnTimeRate(samples, 72)

    expect(rate).toBe(50) // 2 on-time out of 4 total = 50%
  })

  it('should use default SLA of 72 hours when not specified', () => {
    const samples = [
      { tatHours: 70 }, // on-time with default
      { tatHours: 80 }, // late with default
    ]

    const rate = calculateOnTimeRate(samples)

    expect(rate).toBe(50)
  })

  it('should handle custom SLA thresholds', () => {
    const samples = [
      { tatHours: 24 }, // on-time
      { tatHours: 30 }, // late with 24h SLA
    ]

    const rate = calculateOnTimeRate(samples, 24)

    expect(rate).toBe(50)
  })
})

describe('formatTrendIndicator', () => {
  it('should return positive trend when current > previous', () => {
    const result = formatTrendIndicator(120, 100)

    expect(result.direction).toBe('up')
    expect(result.trend).toBe(20) // (120-100)/100 * 100 = 20%
  })

  it('should return negative trend when current < previous', () => {
    const result = formatTrendIndicator(80, 100)

    expect(result.direction).toBe('down')
    expect(result.trend).toBe(-20) // (80-100)/100 * 100 = -20%
  })

  it('should return stable when change is less than 1%', () => {
    const result = formatTrendIndicator(100.5, 100)

    expect(result.direction).toBe('stable')
    expect(result.trend).toBe(0)
  })

  it('should return stable when current equals previous', () => {
    const result = formatTrendIndicator(100, 100)

    expect(result.direction).toBe('stable')
    expect(result.trend).toBe(0)
  })

  it('should handle division by zero when previous is 0', () => {
    const result = formatTrendIndicator(100, 0)

    expect(result.direction).toBe('stable')
    expect(result.trend).toBe(0)
  })

  it('should handle both values being 0', () => {
    const result = formatTrendIndicator(0, 0)

    expect(result.direction).toBe('stable')
    expect(result.trend).toBe(0)
  })

  it('should handle large percentage increases', () => {
    const result = formatTrendIndicator(200, 50)

    expect(result.direction).toBe('up')
    expect(result.trend).toBe(300) // 300% increase
  })

  it('should handle large percentage decreases', () => {
    const result = formatTrendIndicator(25, 100)

    expect(result.direction).toBe('down')
    expect(result.trend).toBe(-75) // 75% decrease
  })

  it('should treat changes exactly at 1% threshold as stable', () => {
    const result = formatTrendIndicator(100.9, 100)

    expect(result.direction).toBe('stable')
    expect(result.trend).toBe(0) // 0.9% < 1% = stable
  })

  it('should treat changes just over 1% as up/down', () => {
    const resultUp = formatTrendIndicator(101.1, 100)
    const resultDown = formatTrendIndicator(98.9, 100)

    expect(resultUp.direction).toBe('up')
    expect(resultUp.trend).toBeCloseTo(1.1, 1)

    expect(resultDown.direction).toBe('down')
    expect(resultDown.trend).toBeCloseTo(-1.1, 1)
  })

  it('should handle decimal values correctly', () => {
    const result = formatTrendIndicator(45.5, 50.3)

    expect(result.direction).toBe('down')
    expect(result.trend).toBeCloseTo(-9.543, 2) // approximately -9.54%
  })
})
