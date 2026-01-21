/**
 * CoA Template Footer Section
 *
 * Renders the absolute-positioned footer with disclaimer and contact info.
 */

/**
 * Render footer - Absolute positioned at bottom
 */
export function renderAbsoluteFooter(): string {
    return `
        <!-- FOOTER -->
        <div class="absolute-footer">
            <div class="footer-disclaimer">
                Kết quả xét nghiệm chỉ có giá trị trên mẫu thử.
            </div>
            <div class="footer-disclaimer">
                Kết quả nằm ngoài khoảng tham chiếu, yêu cầu gặp bác sĩ chỉ định.
            </div>
            <div class="footer-info">
                <div class="footer-address">
                    <svg class="footer-address-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                    </svg>
                    <div class="footer-address-text">
                        <div>Số 01 Ngô Đức Kế, P. Ninh Kiều, Tp. Cần Thơ</div>
                        <div>Số 400 Nguyễn Văn Cừ nối dài, P. An Bình, Tp. Cần Thơ</div>
                    </div>
                </div>
                <div class="footer-code">
                    <div>CDC.STI.M.P.6.12</div>
                    <div>BH: 01 (2025)</div>
                </div>
            </div>
        </div>
    `
}