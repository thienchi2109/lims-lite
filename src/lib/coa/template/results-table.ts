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

/**
 * Render test results table with blue header and light-red specialty groups
 */
export function renderResultsTable(
    results: TestResult[],
    options: ResultsTableRenderOptions = {},
): string {
    const columnCount = options.showAssessment ? 7 : 6

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
                const assessmentCell = options.showAssessment
                    ? `<td class="res-assessment">${escapeHtml(
                        assessment ? ASSESSMENT_LABELS[assessment] : 'Chưa đánh giá',
                    )}</td>`
                    : ''

                return `
                    <tr>
                        <td style="text-align: center;">${escapeHtml(String(totalIndex))}</td>
                        <td class="res-name">${escapeHtml(result.assay_name)}</td>
                        <td class="res-value">${escapeHtml(result.value || '-')}</td>
                        <td class="res-unit">${escapeHtml(result.unit || '')}</td>
                        <td class="res-range">${escapeHtml(result.normal_range || '')}</td>
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
            <thead>
                <tr>
                    <th width="5%">STT</th>
                    <th width="30%">Tên xét nghiệm</th>
                    <th width="15%">Kết quả</th>
                    <th width="10%">Đơn vị</th>
                    <th width="20%">Khoảng tham chiếu</th>
                    <th width="20%">Phương pháp</th>
                    ${options.showAssessment ? '<th width="18%">Đánh giá</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${tbody}
            </tbody>
        </table>
    `
}
