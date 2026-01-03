/**
 * Unit tests for Westgard Multirule QC Evaluation Engine
 *
 * Tests cover:
 * - Z-score calculation with edge cases
 * - Individual rule checks (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10-x)
 * - Orchestrator function with combined rule evaluation
 *
 * Reference: Westgard JO. Basic QC Practices, 4th ed. 2016.
 */

import { describe, it, expect } from 'vitest'
import {
    calculateZScore,
    check1_2s,
    check1_3s,
    check2_2s_withinRun,
    check2_2s_acrossRun,
    checkR_4s,
    check4_1s,
    check10_x,
    evaluateWestgardRules,
} from './westgard-rules'

// ============================================================================
// Z-SCORE CALCULATION TESTS
// ============================================================================

describe('calculateZScore', () => {
    it('calculates Z-score correctly for value above mean', () => {
        // Value 110, Mean 100, SD 5 -> Z = (110-100)/5 = 2
        const result = calculateZScore(110, 100, 5)
        expect(result).toBe(2)
    })

    it('calculates Z-score correctly for value below mean', () => {
        // Value 90, Mean 100, SD 5 -> Z = (90-100)/5 = -2
        const result = calculateZScore(90, 100, 5)
        expect(result).toBe(-2)
    })

    it('returns 0 for value equal to mean', () => {
        const result = calculateZScore(100, 100, 5)
        expect(result).toBe(0)
    })

    it('rounds to 4 decimal places', () => {
        // Value 101, Mean 100, SD 3 -> Z = 1/3 = 0.3333...
        const result = calculateZScore(101, 100, 3)
        expect(result).toBe(0.3333)
    })

    it('returns null for SD of 0', () => {
        const result = calculateZScore(110, 100, 0)
        expect(result).toBeNull()
    })

    it('returns null for negative SD', () => {
        const result = calculateZScore(110, 100, -5)
        expect(result).toBeNull()
    })

    it('returns null for infinite SD', () => {
        const result = calculateZScore(110, 100, Infinity)
        expect(result).toBeNull()
    })

    it('returns null for NaN value', () => {
        const result = calculateZScore(NaN, 100, 5)
        expect(result).toBeNull()
    })

    it('returns null for NaN mean', () => {
        const result = calculateZScore(110, NaN, 5)
        expect(result).toBeNull()
    })

    it('handles negative values correctly', () => {
        // Value -10, Mean -20, SD 5 -> Z = (-10-(-20))/5 = 2
        const result = calculateZScore(-10, -20, 5)
        expect(result).toBe(2)
    })

    it('handles very small SD (precision test)', () => {
        // Value 100.01, Mean 100, SD 0.01 -> Z = 0.01/0.01 = 1
        const result = calculateZScore(100.01, 100, 0.01)
        expect(result).toBe(1)
    })
})

// ============================================================================
// 1-2s RULE TESTS (WARNING RULE)
// ============================================================================

describe('check1_2s', () => {
    it('does not trigger for Z-score within ±2SD', () => {
        const result = check1_2s(1.5)
        expect(result.triggered).toBe(false)
        expect(result.isWarning).toBe(true)
        expect(result.rule).toBe('1-2s')
    })

    it('triggers for Z-score exactly at -2SD boundary', () => {
        // > 2, not >= 2, so exactly 2 should not trigger
        const result = check1_2s(-2)
        expect(result.triggered).toBe(false)
    })

    it('triggers for Z-score exceeding +2SD', () => {
        const result = check1_2s(2.5)
        expect(result.triggered).toBe(true)
        expect(result.isWarning).toBe(true)
        expect(result.message).toContain('Cảnh báo 1-2s')
    })

    it('triggers for Z-score exceeding -2SD', () => {
        const result = check1_2s(-2.5)
        expect(result.triggered).toBe(true)
        expect(result.isWarning).toBe(true)
    })

    it('is always a warning rule (never rejection)', () => {
        const result = check1_2s(2.5)
        expect(result.isWarning).toBe(true)
    })

    it('provides Vietnamese message', () => {
        const result = check1_2s(2.5)
        expect(result.message).toContain('vượt ±2SD')
    })
})

// ============================================================================
// 1-3s RULE TESTS (REJECTION RULE - RANDOM ERROR)
// ============================================================================

describe('check1_3s', () => {
    it('does not trigger for Z-score within ±3SD', () => {
        const result = check1_3s(2.5)
        expect(result.triggered).toBe(false)
        expect(result.isWarning).toBe(false)
        expect(result.rule).toBe('1-3s')
    })

    it('does not trigger for Z-score exactly at 3SD boundary', () => {
        const result = check1_3s(3)
        expect(result.triggered).toBe(false)
    })

    it('triggers for Z-score exceeding +3SD', () => {
        const result = check1_3s(3.5)
        expect(result.triggered).toBe(true)
        expect(result.isWarning).toBe(false)
        expect(result.message).toContain('Từ chối 1-3s')
    })

    it('triggers for Z-score exceeding -3SD', () => {
        const result = check1_3s(-3.5)
        expect(result.triggered).toBe(true)
        expect(result.isWarning).toBe(false)
    })

    it('is a rejection rule (not warning)', () => {
        const result = check1_3s(3.5)
        expect(result.isWarning).toBe(false)
    })

    it('indicates random error in message', () => {
        const result = check1_3s(3.5)
        expect(result.message).toContain('Sai số ngẫu nhiên')
    })
})

// ============================================================================
// 2-2s WITHIN RUN TESTS (SYSTEMATIC ERROR)
// ============================================================================

describe('check2_2s_withinRun', () => {
    it('does not trigger when both levels within 2SD', () => {
        const result = check2_2s_withinRun(1.5, 1.8)
        expect(result.triggered).toBe(false)
        expect(result.rule).toBe('2-2s')
    })

    it('does not trigger when only one level exceeds 2SD', () => {
        const result = check2_2s_withinRun(2.5, 1.5)
        expect(result.triggered).toBe(false)
    })

    it('does not trigger when both exceed 2SD but on opposite sides', () => {
        const result = check2_2s_withinRun(2.5, -2.5)
        expect(result.triggered).toBe(false)
    })

    it('triggers when both levels exceed +2SD', () => {
        const result = check2_2s_withinRun(2.5, 2.3)
        expect(result.triggered).toBe(true)
        expect(result.isWarning).toBe(false)
        expect(result.message).toContain('Sai số hệ thống')
    })

    it('triggers when both levels exceed -2SD', () => {
        const result = check2_2s_withinRun(-2.5, -2.3)
        expect(result.triggered).toBe(true)
    })

    it('is a rejection rule', () => {
        const result = check2_2s_withinRun(2.5, 2.5)
        expect(result.isWarning).toBe(false)
    })

    it('handles edge case at exactly 2SD boundary', () => {
        // Both at exactly 2 should not trigger (> 2, not >= 2)
        const result = check2_2s_withinRun(2, 2)
        expect(result.triggered).toBe(false)
    })
})

// ============================================================================
// 2-2s ACROSS RUN TESTS (PERSISTENT SYSTEMATIC ERROR)
// ============================================================================

describe('check2_2s_acrossRun', () => {
    it('does not trigger when consecutive results within 2SD', () => {
        const result = check2_2s_acrossRun(1.5, 1.8)
        expect(result.triggered).toBe(false)
        expect(result.rule).toBe('2-2s')
    })

    it('does not trigger when only one exceeds 2SD', () => {
        const result = check2_2s_acrossRun(2.5, 1.5)
        expect(result.triggered).toBe(false)
    })

    it('does not trigger when both exceed 2SD but on opposite sides', () => {
        const result = check2_2s_acrossRun(2.5, -2.5)
        expect(result.triggered).toBe(false)
    })

    it('triggers when consecutive results exceed +2SD', () => {
        const result = check2_2s_acrossRun(2.5, 2.3)
        expect(result.triggered).toBe(true)
        expect(result.message).toContain('2 lần chạy liên tiếp')
    })

    it('triggers when consecutive results exceed -2SD', () => {
        const result = check2_2s_acrossRun(-2.5, -2.3)
        expect(result.triggered).toBe(true)
    })

    it('is a rejection rule', () => {
        const result = check2_2s_acrossRun(2.5, 2.5)
        expect(result.isWarning).toBe(false)
    })
})

// ============================================================================
// R-4s RULE TESTS (RANDOM ERROR - RANGE CHECK)
// ============================================================================

describe('checkR_4s', () => {
    it('does not trigger when range is within 4SD', () => {
        const result = checkR_4s(1.5, -1.5) // Range = 3
        expect(result.triggered).toBe(false)
        expect(result.rule).toBe('R-4s')
    })

    it('does not trigger when range is exactly 4SD', () => {
        const result = checkR_4s(2, -2) // Range = 4
        expect(result.triggered).toBe(false)
    })

    it('triggers when range exceeds 4SD (positive to negative)', () => {
        const result = checkR_4s(2.5, -2.5) // Range = 5
        expect(result.triggered).toBe(true)
        expect(result.isWarning).toBe(false)
        expect(result.message).toContain('Khoảng cách')
    })

    it('triggers when range exceeds 4SD (both positive)', () => {
        const result = checkR_4s(3, -1.5) // Range = 4.5
        expect(result.triggered).toBe(true)
    })

    it('handles zero Z-score', () => {
        const result = checkR_4s(3, 0) // Range = 3
        expect(result.triggered).toBe(false)
    })

    it('is a rejection rule', () => {
        const result = checkR_4s(3, -2)
        expect(result.isWarning).toBe(false)
    })

    it('indicates random error in message', () => {
        const result = checkR_4s(3, -2)
        expect(result.message).toContain('Sai số ngẫu nhiên')
    })
})

// ============================================================================
// 4-1s RULE TESTS (TREND DETECTION)
// ============================================================================

describe('check4_1s', () => {
    it('does not trigger with insufficient data (< 4 points)', () => {
        const result = check4_1s([1.2, 1.3, 1.4])
        expect(result.triggered).toBe(false)
        expect(result.message).toContain('Không đủ dữ liệu')
    })

    it('does not trigger when 4 points are within ±1SD', () => {
        const result = check4_1s([0.5, 0.3, -0.2, 0.8])
        expect(result.triggered).toBe(false)
    })

    it('does not trigger when 4 points exceed 1SD but on different sides', () => {
        const result = check4_1s([1.5, -1.5, 1.3, -1.2])
        expect(result.triggered).toBe(false)
    })

    it('triggers when 4 consecutive points exceed +1SD', () => {
        const result = check4_1s([1.2, 1.3, 1.4, 1.5])
        expect(result.triggered).toBe(true)
        expect(result.isWarning).toBe(false)
        expect(result.message).toContain('4 kết quả liên tiếp')
    })

    it('triggers when 4 consecutive points exceed -1SD', () => {
        const result = check4_1s([-1.2, -1.3, -1.4, -1.5])
        expect(result.triggered).toBe(true)
    })

    it('only checks first 4 points (most recent)', () => {
        // First 4 all > 1SD, 5th is < 1SD
        const result = check4_1s([1.2, 1.3, 1.4, 1.5, 0.5])
        expect(result.triggered).toBe(true)
    })

    it('does not trigger when exactly at 1SD boundary', () => {
        // > 1, not >= 1
        const result = check4_1s([1, 1, 1, 1])
        expect(result.triggered).toBe(false)
    })

    it('indicates trend in message', () => {
        const result = check4_1s([1.2, 1.3, 1.4, 1.5])
        expect(result.message).toContain('Xu hướng lệch')
    })
})

// ============================================================================
// 10-x RULE TESTS (SYSTEMATIC SHIFT)
// ============================================================================

describe('check10_x', () => {
    it('does not trigger with insufficient data (< 10 points)', () => {
        const result = check10_x([0.5, 0.3, 0.2, 0.4, 0.6, 0.3, 0.5, 0.4, 0.2])
        expect(result.triggered).toBe(false)
        expect(result.message).toContain('Không đủ dữ liệu')
    })

    it('does not trigger when 10 points cross mean', () => {
        const result = check10_x([0.5, -0.3, 0.2, -0.4, 0.6, -0.3, 0.5, -0.4, 0.2, -0.1])
        expect(result.triggered).toBe(false)
    })

    it('triggers when 10 consecutive points are above mean', () => {
        const result = check10_x([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.1])
        expect(result.triggered).toBe(true)
        expect(result.isWarning).toBe(false)
        expect(result.message).toContain('10 kết quả liên tiếp')
    })

    it('triggers when 10 consecutive points are below mean', () => {
        const result = check10_x([-0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -0.1])
        expect(result.triggered).toBe(true)
    })

    it('only checks first 10 points (most recent)', () => {
        // First 10 all positive, 11th is negative
        const result = check10_x([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.1, -0.5])
        expect(result.triggered).toBe(true)
    })

    it('does not trigger when any point is exactly at mean (0)', () => {
        // All positive except one at exactly 0 (not > 0)
        const result = check10_x([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0])
        expect(result.triggered).toBe(false)
    })

    it('indicates systematic shift in message', () => {
        const result = check10_x([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.1])
        expect(result.message).toContain('Dịch chuyển hệ thống')
    })
})

// ============================================================================
// ORCHESTRATOR TESTS (evaluateWestgardRules)
// ============================================================================

describe('evaluateWestgardRules', () => {
    describe('Z-score calculation integration', () => {
        it('returns reject status for invalid SD', () => {
            const result = evaluateWestgardRules({
                value: 110,
                mean: 100,
                sd: 0,
            })
            expect(result.status).toBe('reject')
            expect(result.zScore).toBeNaN()
            expect(result.recommendation).toContain('kiểm tra giá trị SD')
        })

        it('calculates Z-score correctly', () => {
            const result = evaluateWestgardRules({
                value: 110,
                mean: 100,
                sd: 5,
            })
            expect(result.zScore).toBe(2)
        })
    })

    describe('single-point rules', () => {
        it('returns pass status for value within limits', () => {
            const result = evaluateWestgardRules({
                value: 101,
                mean: 100,
                sd: 5, // Z = 0.2
            })
            expect(result.status).toBe('pass')
            expect(result.triggeredRules).toHaveLength(0)
            expect(result.recommendation).toContain('QC đạt')
        })

        it('returns warning status for 1-2s violation', () => {
            const result = evaluateWestgardRules({
                value: 112,
                mean: 100,
                sd: 5, // Z = 2.4
            })
            expect(result.status).toBe('warning')
            expect(result.triggeredRules).toHaveLength(1)
            expect(result.triggeredRules[0].rule).toBe('1-2s')
            expect(result.recommendation).toContain('Kiểm tra hệ thống')
        })

        it('returns reject status for 1-3s violation', () => {
            const result = evaluateWestgardRules({
                value: 120,
                mean: 100,
                sd: 5, // Z = 4
            })
            expect(result.status).toBe('reject')
            expect(result.triggeredRules.some(r => r.rule === '1-3s')).toBe(true)
            expect(result.recommendation).toContain('DỪNG xét nghiệm')
        })
    })

    describe('within-run rules', () => {
        it('checks 2-2s within run when other levels provided', () => {
            const result = evaluateWestgardRules({
                value: 112,
                mean: 100,
                sd: 5, // Z = 2.4
                otherLevelZScores: [2.5], // Both > 2SD same side
            })
            expect(result.status).toBe('reject')
            expect(result.triggeredRules.some(r => r.rule === '2-2s')).toBe(true)
        })

        it('checks R-4s when other levels provided', () => {
            const result = evaluateWestgardRules({
                value: 115,
                mean: 100,
                sd: 5, // Z = 3
                otherLevelZScores: [-2], // Range = 5 > 4SD
            })
            expect(result.status).toBe('reject')
            expect(result.triggeredRules.some(r => r.rule === 'R-4s')).toBe(true)
        })

        it('does not check within-run rules without other levels', () => {
            const result = evaluateWestgardRules({
                value: 112,
                mean: 100,
                sd: 5, // Z = 2.4 - warning only
            })
            expect(result.triggeredRules.every(r => r.rule !== 'R-4s')).toBe(true)
        })
    })

    describe('across-run rules', () => {
        it('checks 2-2s across runs with history', () => {
            const result = evaluateWestgardRules({
                value: 112,
                mean: 100,
                sd: 5, // Z = 2.4
                history: [2.5], // Previous also > 2SD same side
            })
            expect(result.status).toBe('reject')
            expect(result.triggeredRules.some(r => r.rule === '2-2s')).toBe(true)
        })

        it('does not check across-run rules without history', () => {
            const result = evaluateWestgardRules({
                value: 112,
                mean: 100,
                sd: 5,
            })
            // Only 1-2s warning
            expect(result.status).toBe('warning')
        })
    })

    describe('trend rules', () => {
        it('checks 4-1s with sufficient history', () => {
            const result = evaluateWestgardRules({
                value: 106,
                mean: 100,
                sd: 5, // Z = 1.2
                history: [1.3, 1.4, 1.5], // 4 consecutive > 1SD
            })
            expect(result.status).toBe('reject')
            expect(result.triggeredRules.some(r => r.rule === '4-1s')).toBe(true)
        })

        it('checks 10-x with sufficient history', () => {
            const result = evaluateWestgardRules({
                value: 101,
                mean: 100,
                sd: 5, // Z = 0.2
                history: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], // 10 consecutive same side
            })
            expect(result.status).toBe('reject')
            expect(result.triggeredRules.some(r => r.rule === '10-x')).toBe(true)
        })

        it('does not check trend rules with insufficient history', () => {
            const result = evaluateWestgardRules({
                value: 106,
                mean: 100,
                sd: 5, // Z = 1.2
                history: [1.3, 1.4], // Only 2 history points
            })
            // 4-1s requires 4 points total (current + 3 history)
            expect(result.triggeredRules.every(r => r.rule !== '4-1s')).toBe(true)
        })
    })

    describe('combined violations', () => {
        it('reports multiple violations', () => {
            const result = evaluateWestgardRules({
                value: 120,
                mean: 100,
                sd: 5, // Z = 4 (exceeds both 2s and 3s)
            })
            expect(result.triggeredRules.length).toBeGreaterThan(1)
            expect(result.triggeredRules.some(r => r.rule === '1-2s')).toBe(true)
            expect(result.triggeredRules.some(r => r.rule === '1-3s')).toBe(true)
        })

        it('reject takes precedence over warning', () => {
            const result = evaluateWestgardRules({
                value: 120,
                mean: 100,
                sd: 5, // Triggers both 1-2s (warning) and 1-3s (reject)
            })
            expect(result.status).toBe('reject')
        })

        it('lists rejection rules in recommendation', () => {
            const result = evaluateWestgardRules({
                value: 120,
                mean: 100,
                sd: 5,
            })
            expect(result.recommendation).toContain('1-3s')
        })
    })

    describe('edge cases', () => {
        it('handles empty history array', () => {
            const result = evaluateWestgardRules({
                value: 101,
                mean: 100,
                sd: 5,
                history: [],
            })
            expect(result.status).toBe('pass')
        })

        it('handles empty otherLevelZScores array', () => {
            const result = evaluateWestgardRules({
                value: 101,
                mean: 100,
                sd: 5,
                otherLevelZScores: [],
            })
            expect(result.status).toBe('pass')
        })

        it('handles multiple other levels', () => {
            const result = evaluateWestgardRules({
                value: 112,
                mean: 100,
                sd: 5, // Z = 2.4
                otherLevelZScores: [2.3, 2.6], // Multiple levels all > 2SD
            })
            // Should check against each other level
            expect(result.triggeredRules.filter(r => r.rule === '2-2s').length).toBeGreaterThanOrEqual(1)
        })
    })
})
