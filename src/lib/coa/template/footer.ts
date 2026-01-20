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
                Ket qua xet nghiem chi co gia tri tren mau thu.
            </div>
            <div class="footer-disclaimer">
                Ket qua nam ngoai khoang tham chieu, yeu cau gap bac si chi dinh.
            </div>
            <div class="footer-info">
                <div class="footer-address">
                    <svg class="footer-address-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                    </svg>
                    <div class="footer-address-text">
                        <div>So 01 Ngo Duc Ke, P. Ninh Kieu, Tp. Can Tho</div>
                        <div>So 400 Nguyen Van Cu noi dai, P. An Binh, Tp. Can Tho</div>
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
