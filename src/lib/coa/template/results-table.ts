/**
 * CoA Template Results Table Section
 *
 * Renders test results table with blue header and light-red specialty groups.
 */

import type { TestResult } from '../helpers'
import type { ResultReferenceAssessment } from '@/types'
import { escapeHtml } from './escape'

export interface ResultsTableRenderOptions {
    assessments?: Record<string, ResultReferenceAssessment>
    showAssessment?: boolean
}

const ASSESSMENT_LABELS: Record<ResultReferenceAssessment, string> = {
    within_reference_range: 'Trong khoảng tham chiếu',
    outside_reference_range: 'Ngoài khoảng tham chiếu',
}

const MAX_NOWRAP_MEASUREMENT_LENGTH = 24
const REFERENCE_MEASUREMENT_PATTERN = /^(.*?)([<>≤≥]\s*\d.*|\d.*)$/
const RELEASE_COLUMN_WIDTHS = [5, 25, 15, 10, 25, 20]
const DRAFT_COLUMN_WIDTHS = [5, 23, 11, 8, 25, 14, 14]

function renderReferenceRange(normalRange: string | null): string {
    return (normalRange || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line) => {
            const measurementMatch = line.match(REFERENCE_MEASUREMENT_PATTERN)
            if (!measurementMatch) {
                return `<span class="res-range-line">${escapeHtml(line)}</span>`
            }

            const label = measurementMatch[1].trimEnd()
            const measurement = measurementMatch[2].trim()
            const labelMarkup = label
                ? `<span class="res-range-label">${escapeHtml(`${label} `)}</span>`
                : ''
            const measurementMarkup = [...measurement].length <= MAX_NOWRAP_MEASUREMENT_LENGTH
                ? `<span class="res-range-measurement">${escapeHtml(measurement)}</span>`
                : escapeHtml(measurement)

            return `<span class="res-range-line">${labelMarkup}${measurementMarkup}</span>`
        })
        .join('')
}

/**
 * Render test results table with blue header and light-red specialty groups
 */
export function renderResultsTable(
    results: TestResult[],
    options: ResultsTableRenderOptions = {},
): string {
    const columnCount = options.showAssessment ? 7 : 6
    const columnWidths = options.showAssessment
        ? DRAFT_COLUMN_WIDTHS
        : RELEASE_COLUMN_WIDTHS
    const colgroup = columnWidths
        .map(width => `<col style="width: ${width}%;">`)
        .join('')

    // Group results by lab specialty
    const groups: { [key: string]: TestResult[] } = {}
    const order: string[] = []

    results.forEach(result => {
        const key = result.lab_specialty_name || 'KHÁC'
        if (!groups[key]) {
            groups[key] = []
            order.push(key)
        }
        groups[key].push(result)
    })

    let tbody = ''
    if (results.length === 0) {
        tbody = `
            <tr>
                <td colspan="${columnCount}" style="text-align: center; font-style: italic; color: #666;">
                    Không có kết quả xét nghiệm
                </td>
            </tr>
        `
    } else {
        tbody = order.map(groupName => {
            let groupHtml = ''

            // Add group header if not 'KHÁC' or 'N/A'
            if (groupName !== 'KHÁC' && groupName !== 'N/A') {
                groupHtml += `
                    <tr class="res-group-header">
                        <td colspan="${columnCount}">${escapeHtml(groupName)}</td>
                    </tr>
                `
            }

            // Add result rows for this group
            groupHtml += groups[groupName].map((result) => {
                const totalIndex = results.indexOf(result) + 1
                const assessment = result.result_id
                    ? options.assessments?.[result.result_id]
                    : undefined
                const resultValueClass = assessment === 'outside_reference_range'
                    ? 'res-value res-value-outside-reference-range'
                    : 'res-value'
                const assessmentCell = options.showAssessment
                    ? `<td class="res-assessment">${escapeHtml(
                        assessment ? ASSESSMENT_LABELS[assessment] : 'Chưa đánh giá',
                    )}</td>`
                    : ''

                return `
                    <tr>
                        <td style="text-align: center;">${escapeHtml(String(totalIndex))}</td>
                        <td class="res-name">${escapeHtml(result.assay_name)}</td>
                        <td class="${resultValueClass}">${escapeHtml(result.value || '-')}</td>
                        <td class="res-unit">${escapeHtml(result.unit || '')}</td>
                        <td class="res-range">${renderReferenceRange(result.normal_range)}</td>
                        <td class="res-method">${escapeHtml(result.method_name || '')}</td>
                        ${assessmentCell}
                    </tr>
                `
            }).join('')

            return groupHtml
        }).join('')
    }

    return `
        <!-- RESULTS TABLE -->
        <table class="res-table">
            <colgroup>${colgroup}</colgroup>
            <thead>
                <tr>
                    <th>STT</th>
                    <th>Tên xét nghiệm</th>
                    <th>Kết quả</th>
                    <th>Đơn vị</th>
                    <th>Khoảng tham chiếu</th>
                    <th>Phương pháp</th>
                    ${options.showAssessment ? '<th>Đánh giá</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${tbody}
            </tbody>
        </table>
    `
}
