/**
 * Unit tests for Six Sigma Metrics for Laboratory QC
 *
 * Tests cover:
 * - Bias calculation
 * - Coefficient of Variation (CV) calculation
 * - Sigma metric calculation
 * - Quality level assessment
 * - Westgard rule selection based on sigma
 * - QC frequency recommendations
 * - Complete sigma metrics calculation
 *
 * Reference: Westgard JO. Six Sigma Quality Design & Control, 2nd ed. 2006.
 */

import { describe, it, expect } from 'vitest'
import {
    calculateBias,
    calculateCV,
    calculateSigma,
    getSigmaQualityLevel,
    getQualityLevelDescription,
    selectWestgardRules,
    getRecommendedQCFrequency,
    calculateSigmaMetrics,
} from './sigma-metrics'

// ============================================================================
// BIAS CALCULATION TESTS
// ============================================================================

describe('calculateBias', () => {
    it('calculates positive bias correctly', () => {
        // Lab mean 105, Peer mean 100 -> Bias = (105-100)/100 * 100 = 5%
        const result = calculateBias(105, 100)
        expect(result).toBe(5)
    })

    it('calculates negative bias correctly', () => {
        // Lab mean 95, Peer mean 100 -> Bias = (95-100)/100 * 100 = -5%
        const result = calculateBias(95, 100)
        expect(result).toBe(-5)
    })

    it('returns 0 for matching means', () => {
        const result = calculateBias(100, 100)
        expect(result).toBe(0)
    })

    it('rounds to 2 decimal places', () => {
        // Lab mean 101, Peer mean 100 -> Bias = 1%
        // Lab mean 103, Peer mean 99 -> Bias = (103-99)/99 * 100 = 4.0404...
        const result = calculateBias(103, 99)
        expect(result).toBe(4.04)
    })

    it('returns null for peer group mean of 0', () => {
        const result = calculateBias(100, 0)
        expect(result).toBeNull()
    })

    it('returns null for infinite peer group mean', () => {
        const result = calculateBias(100, Infinity)
        expect(result).toBeNull()
    })

    it('returns null for NaN lab mean', () => {
        const result = calculateBias(NaN, 100)
        expect(result).toBeNull()
    })

    it('handles negative values correctly', () => {
        // Lab mean -95, Peer mean -100 -> Bias = (-95-(-100))/-100 * 100 = -5%
        const result = calculateBias(-95, -100)
        expect(result).toBe(-5)
    })

    it('handles very small peer group mean', () => {
        const result = calculateBias(0.01, 0.009)
        expect(result).toBeCloseTo(11.11, 1)
    })
})

// ============================================================================
// CV CALCULATION TESTS
// ============================================================================

describe('calculateCV', () => {
    it('calculates CV correctly', () => {
        // SD 5, Mean 100 -> CV = 5/100 * 100 = 5%
        const result = calculateCV(5, 100)
        expect(result).toBe(5)
    })

    it('returns 0 for SD of 0', () => {
        const result = calculateCV(0, 100)
        expect(result).toBe(0)
    })

    it('rounds to 2 decimal places', () => {
        // SD 3, Mean 99 -> CV = 3/99 * 100 = 3.0303...
        const result = calculateCV(3, 99)
        expect(result).toBe(3.03)
    })

    it('returns null for mean of 0', () => {
        const result = calculateCV(5, 0)
        expect(result).toBeNull()
    })

    it('returns null for infinite mean', () => {
        const result = calculateCV(5, Infinity)
        expect(result).toBeNull()
    })

    it('returns null for negative SD', () => {
        const result = calculateCV(-5, 100)
        expect(result).toBeNull()
    })

    it('returns null for infinite SD', () => {
        const result = calculateCV(Infinity, 100)
        expect(result).toBeNull()
    })

    it('uses absolute value of mean for calculation', () => {
        // SD 5, Mean -100 -> CV = 5/|-100| * 100 = 5%
        const result = calculateCV(5, -100)
        expect(result).toBe(5)
    })

    it('handles very small SD', () => {
        const result = calculateCV(0.01, 100)
        expect(result).toBe(0.01)
    })
})

// ============================================================================
// SIGMA CALCULATION TESTS
// ============================================================================

describe('calculateSigma', () => {
    it('calculates sigma correctly with zero bias', () => {
        // TEa 10%, Bias 0%, CV 2% -> Sigma = (10-0)/2 = 5
        const result = calculateSigma(10, 0, 2)
        expect(result).toBe(5)
    })

    it('calculates sigma correctly with positive bias', () => {
        // TEa 10%, Bias 2%, CV 2% -> Sigma = (10-2)/2 = 4
        const result = calculateSigma(10, 2, 2)
        expect(result).toBe(4)
    })

    it('calculates sigma correctly with negative bias', () => {
        // TEa 10%, Bias -2%, CV 2% -> Sigma = (10-|-2|)/2 = 4
        const result = calculateSigma(10, -2, 2)
        expect(result).toBe(4)
    })

    it('can return negative sigma when bias exceeds TEa', () => {
        // TEa 5%, Bias 8%, CV 2% -> Sigma = (5-8)/2 = -1.5
        const result = calculateSigma(5, 8, 2)
        expect(result).toBe(-1.5)
    })

    it('rounds to 2 decimal places', () => {
        // TEa 10%, Bias 1%, CV 3% -> Sigma = (10-1)/3 = 3
        const result = calculateSigma(10, 1, 3)
        expect(result).toBe(3)
    })

    it('returns null for CV of 0', () => {
        const result = calculateSigma(10, 2, 0)
        expect(result).toBeNull()
    })

    it('returns null for negative CV', () => {
        const result = calculateSigma(10, 2, -2)
        expect(result).toBeNull()
    })

    it('returns null for negative TEa', () => {
        const result = calculateSigma(-10, 2, 2)
        expect(result).toBeNull()
    })

    it('returns null for infinite CV', () => {
        const result = calculateSigma(10, 2, Infinity)
        expect(result).toBeNull()
    })

    it('returns null for NaN bias', () => {
        const result = calculateSigma(10, NaN, 2)
        expect(result).toBeNull()
    })

    it('handles high performance scenario (sigma > 6)', () => {
        // TEa 15%, Bias 1%, CV 2% -> Sigma = (15-1)/2 = 7
        const result = calculateSigma(15, 1, 2)
        expect(result).toBe(7)
    })
})

// ============================================================================
// SIGMA QUALITY LEVEL TESTS
// ============================================================================

describe('getSigmaQualityLevel', () => {
    it('returns world-class for sigma >= 6', () => {
        expect(getSigmaQualityLevel(6)).toBe('world-class')
        expect(getSigmaQualityLevel(7)).toBe('world-class')
        expect(getSigmaQualityLevel(10)).toBe('world-class')
    })

    it('returns excellent for sigma 5-6', () => {
        expect(getSigmaQualityLevel(5)).toBe('excellent')
        expect(getSigmaQualityLevel(5.5)).toBe('excellent')
        expect(getSigmaQualityLevel(5.99)).toBe('excellent')
    })

    it('returns good for sigma 4-5', () => {
        expect(getSigmaQualityLevel(4)).toBe('good')
        expect(getSigmaQualityLevel(4.5)).toBe('good')
        expect(getSigmaQualityLevel(4.99)).toBe('good')
    })

    it('returns marginal for sigma 3-4', () => {
        expect(getSigmaQualityLevel(3)).toBe('marginal')
        expect(getSigmaQualityLevel(3.5)).toBe('marginal')
        expect(getSigmaQualityLevel(3.99)).toBe('marginal')
    })

    it('returns poor for sigma 2-3', () => {
        expect(getSigmaQualityLevel(2)).toBe('poor')
        expect(getSigmaQualityLevel(2.5)).toBe('poor')
        expect(getSigmaQualityLevel(2.99)).toBe('poor')
    })

    it('returns unacceptable for sigma < 2', () => {
        expect(getSigmaQualityLevel(1.99)).toBe('unacceptable')
        expect(getSigmaQualityLevel(1)).toBe('unacceptable')
        expect(getSigmaQualityLevel(0)).toBe('unacceptable')
        expect(getSigmaQualityLevel(-1)).toBe('unacceptable')
    })
})

// ============================================================================
// QUALITY LEVEL DESCRIPTION TESTS
// ============================================================================

describe('getQualityLevelDescription', () => {
    it('provides Vietnamese description for world-class', () => {
        const desc = getQualityLevelDescription('world-class')
        expect(desc).toContain('Đẳng cấp thế giới')
        expect(desc).toContain('xuất sắc')
    })

    it('provides Vietnamese description for excellent', () => {
        const desc = getQualityLevelDescription('excellent')
        expect(desc).toContain('Xuất sắc')
    })

    it('provides Vietnamese description for good', () => {
        const desc = getQualityLevelDescription('good')
        expect(desc).toContain('Tốt')
    })

    it('provides Vietnamese description for marginal', () => {
        const desc = getQualityLevelDescription('marginal')
        expect(desc).toContain('Biên')
        expect(desc).toContain('QC nghiêm ngặt')
    })

    it('provides Vietnamese description for poor', () => {
        const desc = getQualityLevelDescription('poor')
        expect(desc).toContain('Kém')
        expect(desc).toContain('cải thiện')
    })

    it('provides Vietnamese description for unacceptable', () => {
        const desc = getQualityLevelDescription('unacceptable')
        expect(desc).toContain('Không chấp nhận')
        expect(desc).toContain('khắc phục ngay')
    })
})

// ============================================================================
// WESTGARD RULE SELECTION TESTS
// ============================================================================

describe('selectWestgardRules', () => {
    it('returns only 1-3s for sigma >= 6', () => {
        const rules = selectWestgardRules(6)
        expect(rules).toEqual(['1-3s'])
    })

    it('returns 1-3s and 2-2s for sigma 5-6', () => {
        const rules = selectWestgardRules(5.5)
        expect(rules).toEqual(['1-3s', '2-2s'])
    })

    it('returns 1-3s, 2-2s, R-4s for sigma 4-5', () => {
        const rules = selectWestgardRules(4.5)
        expect(rules).toEqual(['1-3s', '2-2s', 'R-4s'])
    })

    it('returns 1-3s, 2-2s, R-4s, 4-1s for sigma 3-4', () => {
        const rules = selectWestgardRules(3.5)
        expect(rules).toEqual(['1-3s', '2-2s', 'R-4s', '4-1s'])
    })

    it('returns all major rules for sigma < 3', () => {
        const rules = selectWestgardRules(2.5)
        expect(rules).toEqual(['1-3s', '2-2s', 'R-4s', '4-1s', '10-x'])
    })

    it('returns all major rules for negative sigma', () => {
        const rules = selectWestgardRules(-1)
        expect(rules).toEqual(['1-3s', '2-2s', 'R-4s', '4-1s', '10-x'])
    })

    it('never includes 1-2s (warning only rule)', () => {
        // 1-2s is always used as warning, not in the selection
        expect(selectWestgardRules(6)).not.toContain('1-2s')
        expect(selectWestgardRules(3)).not.toContain('1-2s')
        expect(selectWestgardRules(1)).not.toContain('1-2s')
    })

    it('includes more rules as sigma decreases', () => {
        const sigma6 = selectWestgardRules(6).length
        const sigma5 = selectWestgardRules(5).length
        const sigma4 = selectWestgardRules(4).length
        const sigma3 = selectWestgardRules(3).length
        const sigma2 = selectWestgardRules(2).length

        expect(sigma6).toBeLessThan(sigma5)
        expect(sigma5).toBeLessThan(sigma4)
        expect(sigma4).toBeLessThan(sigma3)
        expect(sigma3).toBeLessThan(sigma2)
    })
})

// ============================================================================
// QC FREQUENCY RECOMMENDATION TESTS
// ============================================================================

describe('getRecommendedQCFrequency', () => {
    it('recommends minimal QC for sigma >= 6', () => {
        const rec = getRecommendedQCFrequency(6)
        expect(rec.runsPerDay).toBe(1)
        expect(rec.levelsPerRun).toBe(1)
        expect(rec.description).toContain('tối thiểu')
    })

    it('recommends standard QC for sigma 5-6', () => {
        const rec = getRecommendedQCFrequency(5.5)
        expect(rec.runsPerDay).toBe(1)
        expect(rec.levelsPerRun).toBe(2)
        expect(rec.description).toContain('chuẩn')
    })

    it('recommends enhanced QC for sigma 4-5', () => {
        const rec = getRecommendedQCFrequency(4.5)
        expect(rec.runsPerDay).toBe(2)
        expect(rec.levelsPerRun).toBe(2)
        expect(rec.description).toContain('tăng cường')
    })

    it('recommends strict QC for sigma 3-4', () => {
        const rec = getRecommendedQCFrequency(3.5)
        expect(rec.runsPerDay).toBe(3)
        expect(rec.levelsPerRun).toBe(2)
        expect(rec.description).toContain('chặt chẽ')
    })

    it('recommends maximum QC for sigma < 3', () => {
        const rec = getRecommendedQCFrequency(2)
        expect(rec.runsPerDay).toBe(4)
        expect(rec.levelsPerRun).toBe(3)
        expect(rec.description).toContain('tối đa')
        expect(rec.description).toContain('Cần cải thiện')
    })

    it('increases runs per day as sigma decreases', () => {
        const freq6 = getRecommendedQCFrequency(6).runsPerDay
        const freq5 = getRecommendedQCFrequency(5).runsPerDay
        const freq4 = getRecommendedQCFrequency(4).runsPerDay
        const freq3 = getRecommendedQCFrequency(3).runsPerDay
        const freq2 = getRecommendedQCFrequency(2).runsPerDay

        expect(freq6).toBeLessThanOrEqual(freq5)
        expect(freq5).toBeLessThanOrEqual(freq4)
        expect(freq4).toBeLessThanOrEqual(freq3)
        expect(freq3).toBeLessThanOrEqual(freq2)
    })
})

// ============================================================================
// COMPLETE SIGMA METRICS CALCULATION TESTS
// ============================================================================

describe('calculateSigmaMetrics', () => {
    it('calculates complete metrics for high-quality assay', () => {
        const result = calculateSigmaMetrics({
            labMean: 100,
            peerGroupMean: 100,
            sd: 2,
            tea: 10,
        })

        expect(result).not.toBeNull()
        expect(result!.bias).toBe(0)
        expect(result!.cv).toBe(2)
        expect(result!.sigma).toBe(5)
        expect(result!.qualityLevel).toBe('excellent')
        expect(result!.recommendedRules).toEqual(['1-3s', '2-2s'])
        expect(result!.description).toContain('Xuất sắc')
    })

    it('calculates complete metrics for marginal assay', () => {
        const result = calculateSigmaMetrics({
            labMean: 102,
            peerGroupMean: 100,
            sd: 3,
            tea: 10,
        })

        expect(result).not.toBeNull()
        expect(result!.bias).toBe(2)
        expect(result!.cv).toBeCloseTo(2.94, 1)
        // Sigma = (10 - 2) / 2.94 = 2.72
        expect(result!.qualityLevel).toBe('poor')
    })

    it('returns null for invalid peer group mean', () => {
        const result = calculateSigmaMetrics({
            labMean: 100,
            peerGroupMean: 0,
            sd: 2,
            tea: 10,
        })
        expect(result).toBeNull()
    })

    it('returns null for invalid lab mean (produces null CV)', () => {
        const result = calculateSigmaMetrics({
            labMean: 0,
            peerGroupMean: 100,
            sd: 2,
            tea: 10,
        })
        expect(result).toBeNull()
    })

    it('returns null for negative SD', () => {
        const result = calculateSigmaMetrics({
            labMean: 100,
            peerGroupMean: 100,
            sd: -2,
            tea: 10,
        })
        expect(result).toBeNull()
    })

    it('includes TEa in result', () => {
        const result = calculateSigmaMetrics({
            labMean: 100,
            peerGroupMean: 100,
            sd: 2,
            tea: 15,
        })

        expect(result).not.toBeNull()
        expect(result!.tea).toBe(15)
    })

    it('handles world-class performance', () => {
        const result = calculateSigmaMetrics({
            labMean: 100,
            peerGroupMean: 100,
            sd: 1,
            tea: 10, // Sigma = 10/1 = 10
        })

        expect(result).not.toBeNull()
        expect(result!.sigma).toBe(10)
        expect(result!.qualityLevel).toBe('world-class')
        expect(result!.recommendedRules).toEqual(['1-3s'])
    })

    it('handles unacceptable performance', () => {
        const result = calculateSigmaMetrics({
            labMean: 105,
            peerGroupMean: 100,
            sd: 4,
            tea: 8, // Sigma = (8-5)/4 = 0.75
        })

        expect(result).not.toBeNull()
        expect(result!.sigma).toBeLessThan(2)
        expect(result!.qualityLevel).toBe('unacceptable')
        expect(result!.recommendedRules).toContain('10-x')
    })

    it('handles negative sigma (bias > TEa)', () => {
        const result = calculateSigmaMetrics({
            labMean: 110,
            peerGroupMean: 100,
            sd: 2,
            tea: 5, // Sigma = (5-10)/2 = -2.5
        })

        expect(result).not.toBeNull()
        expect(result!.sigma).toBeLessThan(0)
        expect(result!.qualityLevel).toBe('unacceptable')
    })
})

// ============================================================================
// EDGE CASES AND INTEGRATION TESTS
// ============================================================================

describe('Integration tests', () => {
    it('rule selection aligns with quality level assessment', () => {
        // World-class should have minimal rules
        expect(selectWestgardRules(6).length).toBe(1)
        expect(getSigmaQualityLevel(6)).toBe('world-class')

        // Unacceptable should have maximum rules
        expect(selectWestgardRules(1).length).toBe(5)
        expect(getSigmaQualityLevel(1)).toBe('unacceptable')
    })

    it('QC frequency aligns with quality level', () => {
        // World-class = minimal QC
        const worldClass = getRecommendedQCFrequency(6)
        expect(worldClass.runsPerDay * worldClass.levelsPerRun).toBe(1)

        // Unacceptable = maximum QC
        const unacceptable = getRecommendedQCFrequency(1)
        expect(unacceptable.runsPerDay * unacceptable.levelsPerRun).toBe(12)
    })

    it('realistic glucose assay scenario', () => {
        // Typical glucose: TEa = 10%, Lab CV = 2%, Bias = 1%
        const result = calculateSigmaMetrics({
            labMean: 101,
            peerGroupMean: 100,
            sd: 2,
            tea: 10,
        })

        expect(result).not.toBeNull()
        expect(result!.bias).toBe(1)
        expect(result!.cv).toBeCloseTo(1.98, 1)
        // Sigma = (10-1)/1.98 = 4.55
        expect(result!.sigma).toBeGreaterThan(4)
        expect(result!.qualityLevel).toBe('good')
    })

    it('realistic cholesterol assay scenario', () => {
        // Typical cholesterol: TEa = 9%, Lab CV = 3%, Bias = 2%
        const result = calculateSigmaMetrics({
            labMean: 204,
            peerGroupMean: 200,
            sd: 6,
            tea: 9,
        })

        expect(result).not.toBeNull()
        expect(result!.bias).toBe(2)
        expect(result!.cv).toBeCloseTo(2.94, 1)
        // Sigma = (9-2)/2.94 = 2.38
        expect(result!.sigma).toBeLessThan(3)
        expect(result!.qualityLevel).toBe('poor')
        expect(result!.recommendedRules).toContain('10-x')
    })
})
