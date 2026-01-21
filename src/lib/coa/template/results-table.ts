/**
 * CoA Template Results Table Section
 *
 * Renders test results table with blue header and light-red specialty groups.
 */

import type { TestResult } from '../helpers'

/**
 * Render test results table with blue header and light-red specialty groups
 */
export function renderResultsTable(results: TestResult[]): string {
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
                <td colspan="6" style="text-align: center; font-style: italic; color: #666;">
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
                        <td colspan="6">${groupName}</td>
                    </tr>
                `
            }

            // Add result rows for this group
            groupHtml += groups[groupName].map((result) => {
                const totalIndex = results.indexOf(result) + 1
                return `
                    <tr>
                        <td style="text-align: center;">${totalIndex}</td>
                        <td class="res-name">${result.assay_name}</td>
                        <td class="res-value">${result.value || '-'}</td>
                        <td class="res-unit">${result.unit || ''}</td>
                        <td class="res-range">${result.normal_range || ''}</td>
                        <td class="res-method">${result.method_name || ''}</td>
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
                </tr>
            </thead>
            <tbody>
                ${tbody}
            </tbody>
        </table>
    `
}
