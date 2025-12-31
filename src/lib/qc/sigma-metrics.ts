import type { WestgardRule } from '@/types/qc'

// ============================================================================
// SIX SIGMA METRICS FOR LABORATORY QC
// ============================================================================
// Implements Six Sigma quality metrics for analytical performance assessment.
// Reference: Westgard JO. Six Sigma Quality Design & Control, 2nd ed. 2006.

/**
 * Sigma metrics result with quality assessment
 */
export interface SigmaMetrics {
    sigma: number
    bias: number
    cv: number
    tea: number
    qualityLevel: SigmaQualityLevel
    recommendedRules: WestgardRule[]
    description: string
}

/**
 * Quality level based on sigma value
 */
export type SigmaQualityLevel =
    | 'world-class'   // σ ≥ 6
    | 'excellent'     // 5 ≤ σ < 6
    | 'good'          // 4 ≤ σ < 5
    | 'marginal'      // 3 ≤ σ < 4
    | 'poor'          // 2 ≤ σ < 3
    | 'unacceptable'  // σ < 2

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Calculate Bias (systematic error) as percentage
 * Bias% = ((Lab Mean - Peer Group Mean) / Peer Group Mean) × 100
 *
 * @param labMean - Laboratory's measured mean value
 * @param peerGroupMean - Peer group or reference mean value
 * @returns Bias as percentage (can be negative)
 */
export function calculateBias(labMean: number, peerGroupMean: number): number | null {
    if (peerGroupMean === 0 || !isFinite(peerGroupMean)) return null
    if (!isFinite(labMean)) return null

    const bias = ((labMean - peerGroupMean) / peerGroupMean) * 100
    return Math.round(bias * 100) / 100 // 2 decimal places
}

/**
 * Calculate Coefficient of Variation (CV) as percentage
 * CV% = (SD / Mean) × 100
 *
 * @param sd - Standard deviation
 * @param mean - Mean value
 * @returns CV as percentage
 */
export function calculateCV(sd: number, mean: number): number | null {
    if (mean === 0 || !isFinite(mean)) return null
    if (sd < 0 || !isFinite(sd)) return null

    const cv = (sd / Math.abs(mean)) * 100
    return Math.round(cv * 100) / 100 // 2 decimal places
}

/**
 * Calculate Sigma metric
 * Sigma = (TEa% - |Bias%|) / CV%
 *
 * @param tea - Total Allowable Error as percentage
 * @param bias - Bias as percentage (absolute value used)
 * @param cv - Coefficient of Variation as percentage
 * @returns Sigma value (can be negative if TEa < Bias)
 */
export function calculateSigma(tea: number, bias: number, cv: number): number | null {
    if (cv <= 0 || !isFinite(cv)) return null
    if (tea < 0 || !isFinite(tea)) return null
    if (!isFinite(bias)) return null

    const sigma = (tea - Math.abs(bias)) / cv
    return Math.round(sigma * 100) / 100 // 2 decimal places
}

// ============================================================================
// QUALITY ASSESSMENT
// ============================================================================

/**
 * Determine quality level from sigma value
 */
export function getSigmaQualityLevel(sigma: number): SigmaQualityLevel {
    if (sigma >= 6) return 'world-class'
    if (sigma >= 5) return 'excellent'
    if (sigma >= 4) return 'good'
    if (sigma >= 3) return 'marginal'
    if (sigma >= 2) return 'poor'
    return 'unacceptable'
}

/**
 * Get Vietnamese description for quality level
 */
export function getQualityLevelDescription(level: SigmaQualityLevel): string {
    const descriptions: Record<SigmaQualityLevel, string> = {
        'world-class': 'Đẳng cấp thế giới - Chất lượng xuất sắc, ít cần QC',
        'excellent': 'Xuất sắc - Chất lượng rất tốt, QC đơn giản',
        'good': 'Tốt - Chất lượng đạt yêu cầu, QC tiêu chuẩn',
        'marginal': 'Biên - Cần theo dõi chặt, QC nghiêm ngặt',
        'poor': 'Kém - Cần cải thiện quy trình, QC tối đa',
        'unacceptable': 'Không chấp nhận - Cần hành động khắc phục ngay'
    }
    return descriptions[level]
}

// ============================================================================
// WESTGARD RULE SELECTION
// ============================================================================

/**
 * Auto-select Westgard rules based on sigma level
 * Higher sigma = fewer rules needed
 * Lower sigma = more stringent rules required
 *
 * Based on Westgard Sigma Rules selection chart.
 */
export function selectWestgardRules(sigma: number): WestgardRule[] {
    if (sigma >= 6) {
        // World-class: Only single rule needed
        return ['1-3s']
    }

    if (sigma >= 5) {
        // Excellent: Two rules
        return ['1-3s', '2-2s']
    }

    if (sigma >= 4) {
        // Good: Standard multirule
        return ['1-3s', '2-2s', 'R-4s']
    }

    if (sigma >= 3) {
        // Marginal: Extended multirule with trend detection
        return ['1-3s', '2-2s', 'R-4s', '4-1s']
    }

    // Poor/Unacceptable: Maximum rules + shift detection
    return ['1-3s', '2-2s', 'R-4s', '4-1s', '10-x']
}

/**
 * Get number of QC runs recommended based on sigma
 * Lower sigma = more frequent QC
 */
export function getRecommendedQCFrequency(sigma: number): {
    runsPerDay: number
    levelsPerRun: number
    description: string
} {
    if (sigma >= 6) {
        return {
            runsPerDay: 1,
            levelsPerRun: 1,
            description: 'QC tối thiểu: 1 lần/ngày, 1 mức'
        }
    }

    if (sigma >= 5) {
        return {
            runsPerDay: 1,
            levelsPerRun: 2,
            description: 'QC chuẩn: 1 lần/ngày, 2 mức'
        }
    }

    if (sigma >= 4) {
        return {
            runsPerDay: 2,
            levelsPerRun: 2,
            description: 'QC tăng cường: 2 lần/ngày, 2 mức'
        }
    }

    if (sigma >= 3) {
        return {
            runsPerDay: 3,
            levelsPerRun: 2,
            description: 'QC chặt chẽ: 3 lần/ngày, 2 mức'
        }
    }

    return {
        runsPerDay: 4,
        levelsPerRun: 3,
        description: 'QC tối đa: 4 lần/ngày, 3 mức - Cần cải thiện quy trình'
    }
}

// ============================================================================
// COMPLETE ASSESSMENT
// ============================================================================

export interface CalculateSigmaMetricsInput {
    labMean: number
    peerGroupMean: number
    sd: number
    tea: number
}

/**
 * Calculate complete Six Sigma metrics with recommendations
 */
export function calculateSigmaMetrics(input: CalculateSigmaMetricsInput): SigmaMetrics | null {
    const { labMean, peerGroupMean, sd, tea } = input

    const bias = calculateBias(labMean, peerGroupMean)
    if (bias === null) return null

    const cv = calculateCV(sd, labMean)
    if (cv === null) return null

    const sigma = calculateSigma(tea, bias, cv)
    if (sigma === null) return null

    const qualityLevel = getSigmaQualityLevel(sigma)
    const recommendedRules = selectWestgardRules(sigma)
    const description = getQualityLevelDescription(qualityLevel)

    return {
        sigma,
        bias,
        cv,
        tea,
        qualityLevel,
        recommendedRules,
        description
    }
}
