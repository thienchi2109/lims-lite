/**
 * CoA Template Styles
 *
 * CSS stylesheet for Certificate of Analysis - Blue theme, A4 layout.
 * 21 CFR Part 11 compliant Vietnamese CDC lab format.
 */

/**
 * Get the complete CSS stylesheet for CoA template
 */
export function getStylesheet(): string {
    return `
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Times New Roman', serif;
            font-size: 14px; color: #000; line-height: 1.4;
            background: #f3f4f6; margin: 0; padding: 32px;
        }

        .page {
            width: 210mm; min-height: 297mm; background: #fff;
            position: relative; margin: 0 auto; padding: 32px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .watermark {
            position: absolute; inset: 0; display: flex;
            align-items: center; justify-content: center;
            pointer-events: none; overflow: hidden; z-index: 0;
        }

        .watermark-text {
            font-size: 100px; font-weight: bold; color: #93c5fd;
            opacity: 0.1; transform: rotate(-45deg); white-space: nowrap;
            letter-spacing: 0; font-family: 'Times New Roman', serif;
        }

        .watermark-text.draft {
            max-width: 180mm; white-space: normal; text-align: center;
            font-size: 44px; color: #dc2626; opacity: 0.12;
        }

        .content { position: relative; z-index: 10; padding-bottom: 120px; }

        .header {
            display: flex; align-items: flex-start; gap: 24px;
            border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;
        }

        .header-left { flex-shrink: 0; padding-top: 4px; }
        .logo { width: 96px; height: 96px; object-fit: contain; }
        .header-center { flex: 1; text-align: center; }
        .org-parent { font-size: 14px; color: #2563eb; font-weight: 500; line-height: 1; }
        .org-name { font-size: 18px; font-weight: bold; color: #1d4ed8; margin-top: 4px; line-height: 1.2; }
        .org-english { font-size: 11px; color: #4b5563; margin-top: 4px; margin-bottom: 12px; line-height: 1; }
        .form-name { font-size: 28px; font-weight: bold; color: #1d4ed8; letter-spacing: 0.05em; line-height: 1; }
        .form-name-en { font-size: 18px; font-style: italic; color: #2563eb; margin-top: 4px; line-height: 1.2; }
        .header-right { flex-shrink: 0; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .qr-img { width: 90px; height: 90px; margin-bottom: 8px; }
        .sample-id-box { font-family: monospace; font-size: 12px; font-weight: bold; border: 1px solid #000; padding: 4px 8px; border-radius: 4px; }

        .info-section { margin-bottom: 24px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; }
        .info-row { display: flex; }
        .info-row.full-width { grid-column: 1 / -1; }
        .info-label { font-weight: 600; margin-right: 8px; white-space: nowrap; }
        .info-value { font-weight: 400; }
        .info-value.highlight { text-transform: uppercase; font-weight: bold; font-size: 16px; }

        .res-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px; }
        .res-table th, .res-table td { border: 1px solid #9ca3af; padding: 8px; vertical-align: middle; }
        .res-table th { background-color: #dbeafe; font-weight: 600; text-align: center; }
        .res-group-header td { background-color: #ffe4e6; font-weight: bold; color: #be123c; text-transform: uppercase; padding-left: 16px; }
        .res-name { font-weight: 500; text-align: left; }
        .res-value { font-weight: 400; text-align: center; font-size: 15px; }
        .res-value-outside-reference-range { font-weight: 700; }
        .res-unit { text-align: center; }
        .res-range { text-align: center; font-style: italic; }
        .res-method { text-align: center; font-size: 12px; }
        .res-assessment { text-align: center; font-size: 12px; font-weight: 600; }

        .draft-review-footer {
            margin-top: 24px; border: 1px solid #f59e0b; padding: 12px;
            background: #fffbeb; color: #92400e; text-align: center;
            font-weight: 600;
        }

        .signatures { display: flex; justify-content: space-between; margin-top: 32px; }
        .sig-col { width: 45%; text-align: center; }
        .sig-date { font-style: italic; margin-bottom: 4px; height: 20px; }
        .sig-date.invisible { visibility: hidden; }
        .sig-title { font-weight: 600; margin-bottom: 96px; }
        .sig-name { font-weight: bold; }
        .signature-image { max-width: 200px; max-height: 80px; display: block; margin: -88px auto 8px auto; }
        .manager-signature-stack { position: relative; width: 220px; min-height: 80px; margin: -88px auto 8px auto; }
        .manager-signature-image { margin: 0 auto 8px auto; position: relative; z-index: 1; }
        .manager-stamp-image {
            position: absolute; left: -156px; top: 50%; transform: translateY(-50%);
            width: 240px; height: auto; z-index: 2; pointer-events: none;
        }

        .absolute-footer {
            position: absolute; left: 32px; right: 32px; bottom: 32px;
            z-index: 10; border-top: 2px solid #2563eb; padding-top: 8px;
            background: #fff; font-size: 9px;
        }
        .footer-disclaimer { font-style: italic; color: #1d4ed8; margin-bottom: 4px; }
        .footer-info { display: flex; justify-content: space-between; align-items: flex-start; }
        .footer-address { display: flex; align-items: flex-start; gap: 8px; }
        .footer-address-icon { width: 12px; height: 12px; color: #1d4ed8; flex-shrink: 0; margin-top: 2px; }
        .footer-address-text { color: #1d4ed8; }
        .footer-code { text-align: right; color: #1d4ed8; }

        .metadata { display: none; }

        @media print {
            body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { box-shadow: none; margin: 0; padding: 32px; }
        }
    `
}

/**
 * Render watermark overlay
 */
export function renderWatermark(label = 'CDC CẦN THƠ'): string {
    const className = label === 'CDC CẦN THƠ' ? 'watermark-text' : 'watermark-text draft'

    return `
        <!-- WATERMARK -->
        <div class="watermark">
            <div class="${className}">${label}</div>
        </div>
    `
}
