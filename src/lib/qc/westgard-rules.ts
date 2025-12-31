import type { WestgardRule, QCResultStatus } from '@/types/qc'

// ============================================================================
// WESTGARD MULTIRULE QC EVALUATION ENGINE
// ============================================================================
// Implements Westgard Multirules for laboratory quality control.
// Reference: Westgard JO. Basic QC Practices, 4th ed. 2016.

/**
 * Result of a single rule evaluation
 */
export interface RuleCheckResult {
    rule: WestgardRule
    triggered: boolean
    isWarning: boolean // true = warning only (1-2s), false = rejection
    message: string
}

/**
 * Complete evaluation result for a QC measurement
 */
export interface WestgardEvaluation {
    status: QCResultStatus
    triggeredRules: RuleCheckResult[]
    zScore: number
    recommendation: string
}

/**
 * Historical QC result for multi-point rules
 */
export interface QCHistoryPoint {
    zScore: number
    value: number
    measuredAt: Date
}

// ============================================================================
// Z-SCORE CALCULATION
// ============================================================================

/**
 * Calculate Z-score (standard deviation index)
 * @param value - Measured QC value
 * @param mean - Target mean from control limits
 * @param sd - Standard deviation from control limits
 * @returns Z-score rounded to 4 decimal places, or null if SD is invalid
 */
export function calculateZScore(
    value: number,
    mean: number,
    sd: number
): number | null {
    if (sd <= 0 || !isFinite(sd)) return null
    if (!isFinite(value) || !isFinite(mean)) return null
    return Math.round(((value - mean) / sd) * 10000) / 10000
}

// ============================================================================
// INDIVIDUAL RULE CHECKS
// ============================================================================

/**
 * 1-2s Rule: WARNING when |z| > 2
 * This is a warning rule only - inspect for problems but don't reject.
 */
export function check1_2s(zScore: number): RuleCheckResult {
    const triggered = Math.abs(zScore) > 2
    return {
        rule: '1-2s',
        triggered,
        isWarning: true,
        message: triggered
            ? `Cảnh báo 1-2s: Z-score ${zScore.toFixed(2)} vượt ±2SD`
            : 'Đạt quy tắc 1-2s'
    }
}

/**
 * 1-3s Rule: REJECT when |z| > 3
 * Indicates random error - single measurement problem.
 */
export function check1_3s(zScore: number): RuleCheckResult {
    const triggered = Math.abs(zScore) > 3
    return {
        rule: '1-3s',
        triggered,
        isWarning: false,
        message: triggered
            ? `Từ chối 1-3s: Z-score ${zScore.toFixed(2)} vượt ±3SD - Sai số ngẫu nhiên`
            : 'Đạt quy tắc 1-3s'
    }
}

/**
 * 2-2s Rule (Within Run): REJECT when 2 controls in same run exceed 2SD on same side
 * Indicates systematic error.
 * @param level1Z - Z-score of level 1 control (e.g., low)
 * @param level2Z - Z-score of level 2 control (e.g., high)
 */
export function check2_2s_withinRun(
    level1Z: number,
    level2Z: number
): RuleCheckResult {
    const sameSign = (level1Z > 0 && level2Z > 0) || (level1Z < 0 && level2Z < 0)
    const bothExceed2SD = Math.abs(level1Z) > 2 && Math.abs(level2Z) > 2
    const triggered = sameSign && bothExceed2SD

    return {
        rule: '2-2s',
        triggered,
        isWarning: false,
        message: triggered
            ? `Từ chối 2-2s: Cả 2 mức đều vượt 2SD cùng phía - Sai số hệ thống`
            : 'Đạt quy tắc 2-2s (trong lần chạy)'
    }
}

/**
 * 2-2s Rule (Across Runs): REJECT when 2 consecutive runs exceed 2SD on same side
 * Indicates persistent systematic error.
 * @param currentZ - Current measurement Z-score
 * @param previousZ - Previous measurement Z-score (same level)
 */
export function check2_2s_acrossRun(
    currentZ: number,
    previousZ: number
): RuleCheckResult {
    const sameSign = (currentZ > 0 && previousZ > 0) || (currentZ < 0 && previousZ < 0)
    const bothExceed2SD = Math.abs(currentZ) > 2 && Math.abs(previousZ) > 2
    const triggered = sameSign && bothExceed2SD

    return {
        rule: '2-2s',
        triggered,
        isWarning: false,
        message: triggered
            ? `Từ chối 2-2s: 2 lần chạy liên tiếp vượt 2SD cùng phía - Sai số hệ thống`
            : 'Đạt quy tắc 2-2s (giữa các lần chạy)'
    }
}

/**
 * R-4s Rule: REJECT when within-run range exceeds 4SD
 * Indicates random error affecting one or both controls.
 * @param level1Z - Z-score of level 1 control
 * @param level2Z - Z-score of level 2 control
 */
export function checkR_4s(level1Z: number, level2Z: number): RuleCheckResult {
    const range = Math.abs(level1Z - level2Z)
    const triggered = range > 4

    return {
        rule: 'R-4s',
        triggered,
        isWarning: false,
        message: triggered
            ? `Từ chối R-4s: Khoảng cách ${range.toFixed(2)}SD vượt 4SD - Sai số ngẫu nhiên`
            : 'Đạt quy tắc R-4s'
    }
}

/**
 * 4-1s Rule: REJECT when 4 consecutive results exceed 1SD on same side
 * Indicates trend/drift in the analytical system.
 * @param history - Last 4 Z-scores (most recent first)
 */
export function check4_1s(history: number[]): RuleCheckResult {
    if (history.length < 4) {
        return {
            rule: '4-1s',
            triggered: false,
            isWarning: false,
            message: 'Không đủ dữ liệu cho quy tắc 4-1s (cần 4 điểm)'
        }
    }

    const last4 = history.slice(0, 4)
    const allPositive = last4.every(z => z > 1)
    const allNegative = last4.every(z => z < -1)
    const triggered = allPositive || allNegative

    return {
        rule: '4-1s',
        triggered,
        isWarning: false,
        message: triggered
            ? `Từ chối 4-1s: 4 kết quả liên tiếp vượt 1SD cùng phía - Xu hướng lệch`
            : 'Đạt quy tắc 4-1s'
    }
}

/**
 * 10-x Rule: REJECT when 10 consecutive results are on same side of mean
 * Indicates systematic shift in the analytical system.
 * @param history - Last 10 Z-scores (most recent first)
 */
export function check10_x(history: number[]): RuleCheckResult {
    if (history.length < 10) {
        return {
            rule: '10-x',
            triggered: false,
            isWarning: false,
            message: 'Không đủ dữ liệu cho quy tắc 10-x (cần 10 điểm)'
        }
    }

    const last10 = history.slice(0, 10)
    const allPositive = last10.every(z => z > 0)
    const allNegative = last10.every(z => z < 0)
    const triggered = allPositive || allNegative

    return {
        rule: '10-x',
        triggered,
        isWarning: false,
        message: triggered
            ? `Từ chối 10-x: 10 kết quả liên tiếp cùng phía mean - Dịch chuyển hệ thống`
            : 'Đạt quy tắc 10-x'
    }
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

export interface EvaluateWestgardInput {
    value: number
    mean: number
    sd: number
    /** Z-scores of other levels measured in same run (for within-run rules) */
    otherLevelZScores?: number[]
    /** Historical Z-scores for same level, most recent first (for trend rules) */
    history?: number[]
}

/**
 * Evaluate all applicable Westgard rules for a QC measurement.
 * Rules are applied in order of severity.
 */
export function evaluateWestgardRules(input: EvaluateWestgardInput): WestgardEvaluation {
    const { value, mean, sd, otherLevelZScores = [], history = [] } = input

    const zScore = calculateZScore(value, mean, sd)
    if (zScore === null) {
        return {
            status: 'reject',
            triggeredRules: [],
            zScore: NaN,
            recommendation: 'Không thể tính Z-score - kiểm tra giá trị SD'
        }
    }

    const results: RuleCheckResult[] = []
    const fullHistory = [zScore, ...history]

    // Single-point rules (always apply)
    results.push(check1_3s(zScore))
    results.push(check1_2s(zScore))

    // Within-run rules (if other levels available)
    if (otherLevelZScores.length > 0) {
        for (const otherZ of otherLevelZScores) {
            results.push(check2_2s_withinRun(zScore, otherZ))
            results.push(checkR_4s(zScore, otherZ))
        }
    }

    // Across-run rules (if history available)
    if (history.length >= 1) {
        results.push(check2_2s_acrossRun(zScore, history[0]))
    }

    // Multi-point trend rules
    if (fullHistory.length >= 4) {
        results.push(check4_1s(fullHistory))
    }
    if (fullHistory.length >= 10) {
        results.push(check10_x(fullHistory))
    }

    // Determine overall status
    const triggeredRules = results.filter(r => r.triggered)
    const hasRejection = triggeredRules.some(r => !r.isWarning)
    const hasWarning = triggeredRules.some(r => r.isWarning)

    let status: QCResultStatus
    let recommendation: string

    if (hasRejection) {
        status = 'reject'
        const rejectionRules = triggeredRules.filter(r => !r.isWarning).map(r => r.rule)
        recommendation = `DỪNG xét nghiệm. Quy tắc vi phạm: ${rejectionRules.join(', ')}. Thực hiện khắc phục sự cố trước khi tiếp tục.`
    } else if (hasWarning) {
        status = 'warning'
        recommendation = 'Kiểm tra hệ thống. Có thể tiếp tục nhưng cần theo dõi chặt chẽ.'
    } else {
        status = 'pass'
        recommendation = 'QC đạt. Tiếp tục xét nghiệm bệnh nhân.'
    }

    return {
        status,
        triggeredRules,
        zScore,
        recommendation
    }
}
