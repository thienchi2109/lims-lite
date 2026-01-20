/**
 * CoA Template Patient Info Section
 *
 * Renders patient and sample information in a grid layout.
 */

import type { CoAData } from '@/types'

/**
 * Render patient and sample information - Grid layout
 */
export function renderPatientInfo(coaData: CoAData): string {
    const receivedDate = coaData.sample.received_date
        ? new Date(coaData.sample.received_date).toLocaleDateString('vi-VN')
        : 'N/A'
    const testingDate = coaData.testingDate
        ? new Date(coaData.testingDate).toLocaleDateString('vi-VN')
        : 'N/A'
    const dob = coaData.sample.client_dob
        ? new Date(coaData.sample.client_dob).toLocaleDateString('vi-VN')
        : 'N/A'

    return `
        <!-- PATIENT & SAMPLE INFO -->
        <div class="info-section">
            <div class="info-grid">
                <div class="info-row full-width">
                    <span class="info-label">Khách hàng:</span>
                    <span class="info-value highlight">${coaData.sample.client_name || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Mã mẫu:</span>
                    <span class="info-value">${coaData.sample.sample_id_display}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Loại mẫu:</span>
                    <span class="info-value">${coaData.sample.sample_type || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Ngày sinh:</span>
                    <span class="info-value">${dob}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Giới tính:</span>
                    <span class="info-value">${coaData.sample.client_gender || 'N/A'}</span>
                </div>
                <div class="info-row full-width">
                    <span class="info-label">Địa chỉ:</span>
                    <span class="info-value">${coaData.sample.client_address || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Số BHYT:</span>
                    <span class="info-value">${coaData.sample.client_health_insurance_num || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Chất lượng mẫu:</span>
                    <span class="info-value">${coaData.manualInputs?.sampleQuality || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Ngày nhận mẫu:</span>
                    <span class="info-value">${receivedDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Ngày xét nghiệm:</span>
                    <span class="info-value">${testingDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Ngày phê duyệt:</span>
                    <span class="info-value">${coaData.approvalDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Bác sĩ chỉ định:</span>
                    <span class="info-value">${coaData.manualInputs?.referrer || 'N/A'}</span>
                </div>
            </div>
        </div>
    `
}
