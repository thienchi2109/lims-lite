import bwipjs from 'bwip-js/browser'
import type { SampleWithUser } from '@/types'

export type SampleLabelPreset =
    | 'thermal-35x23-sheet-2up'
    | 'thermal-35x22-2up'
    | 'small-tube'
    | 'container'

export const DEFAULT_SAMPLE_LABEL_PRESET: SampleLabelPreset = 'thermal-35x23-sheet-2up'

interface SampleLabelOptions {
    preset?: SampleLabelPreset
}

type SampleLabelInput = SampleWithUser & {
    client?: {
        name?: string | null
        date_of_birth?: string | null
    } | null
}

const LABEL_PRESETS: Record<SampleLabelPreset, {
    pageWidth: string
    pageHeight: string
    labelWidth: string
    labelHeight: string
    barcodeHeight: number
    columns: 1 | 2
    columnGap: string
}> = {
    'thermal-35x22-2up': {
        pageWidth: '72mm',
        pageHeight: '22mm',
        labelWidth: '35mm',
        labelHeight: '22mm',
        barcodeHeight: 9,
        columns: 2,
        columnGap: '2mm',
    },
    'thermal-35x23-sheet-2up': {
        pageWidth: '71.1mm',
        pageHeight: '22.9mm',
        labelWidth: '35.5mm',
        labelHeight: '22.9mm',
        barcodeHeight: 9,
        columns: 2,
        columnGap: '0mm',
    },
    'small-tube': {
        pageWidth: '40mm',
        pageHeight: '15mm',
        labelWidth: '40mm',
        labelHeight: '15mm',
        barcodeHeight: 7,
        columns: 1,
        columnGap: '0',
    },
    container: {
        pageWidth: '50mm',
        pageHeight: '25mm',
        labelWidth: '50mm',
        labelHeight: '25mm',
        barcodeHeight: 11,
        columns: 1,
        columnGap: '0',
    },
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function getBirthYear(value: string | null | undefined) {
    if (!value) return ''

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    return String(date.getFullYear())
}

function getClientName(sample: SampleLabelInput) {
    return sample.client?.name?.trim() || sample.client_name?.trim() || ''
}

function getSampleIdFontSize(presetName: SampleLabelPreset) {
    if (isTwoColumnThermalPreset(presetName)) return '6.5pt'
    if (presetName === 'small-tube') return '7.5pt'
    return '9pt'
}

function getMetaFontSize(presetName: SampleLabelPreset) {
    if (isTwoColumnThermalPreset(presetName)) return '5pt'
    if (presetName === 'small-tube') return '6pt'
    return '7pt'
}

function getCompactMetaFontSize(presetName: SampleLabelPreset) {
    if (isTwoColumnThermalPreset(presetName)) return '4.4pt'
    if (presetName === 'small-tube') return '5.2pt'
    return '6pt'
}

function getLabelPadding(presetName: SampleLabelPreset) {
    if (isTwoColumnThermalPreset(presetName)) return '2mm 2mm 1mm 3mm'
    return '1mm 1.5mm'
}

function isTwoColumnThermalPreset(presetName: SampleLabelPreset) {
    return presetName === 'thermal-35x22-2up'
        || presetName === 'thermal-35x23-sheet-2up'
}

export function renderSampleBarcodeSvg(sampleId: string, height: number) {
    const svg = bwipjs.toSVG({
        bcid: 'code128',
        text: sampleId,
        height,
        scaleX: 1.2,
        scaleY: 1,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
        backgroundcolor: 'FFFFFF',
    })

    return svg.replace(
        '<svg ',
        `<svg role="img" aria-label="Barcode ${escapeHtml(sampleId)}" `,
    )
}

export function generateSampleLabelHtml(
    sample: SampleLabelInput,
    options: SampleLabelOptions = {},
) {
    const presetName = options.preset ?? DEFAULT_SAMPLE_LABEL_PRESET
    const preset = LABEL_PRESETS[presetName]
    const sampleId = sample.sample_id
    const clientName = getClientName(sample)
    const birthYear = getBirthYear(sample.client?.date_of_birth)
    const metaItems = [clientName, birthYear].filter(Boolean)
    const isCompactMeta = isTwoColumnThermalPreset(presetName) && metaItems.join(' ').length > 24
    const metaClass = isCompactMeta ? 'meta compact' : 'meta'
    const compactVerticalAttribute = presetName === 'thermal-35x23-sheet-2up'
        ? ' data-compact-vertical="true"'
        : ''
    const barcodeSvg = renderSampleBarcodeSvg(sampleId, preset.barcodeHeight)
    const sheetColumns = Array.from({ length: preset.columns }, () => preset.labelWidth).join(' ')
    const labelCopies = Array.from({ length: preset.columns }, () => `
        <section class="sample-label"${compactVerticalAttribute} aria-label="Nhãn barcode mẫu ${escapeHtml(sampleId)}">
            <div class="sample-id">${escapeHtml(sampleId)}</div>
            <div class="barcode">${barcodeSvg}</div>
            <div class="${metaClass}">
                ${metaItems.map((item) => `<span>${escapeHtml(item)}</span>`).join('<span>|</span>')}
            </div>
        </section>`).join('')

    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8" />
    <title>Nhãn barcode - ${escapeHtml(sampleId)}</title>
    <style>
        @page {
            size: ${preset.pageWidth} ${preset.pageHeight};
            margin: 0;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            width: ${preset.pageWidth};
            height: ${preset.labelHeight};
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #fff;
            color: #000;
            font-family: Arial, sans-serif;
        }

        .label-sheet {
            width: ${preset.pageWidth};
            height: ${preset.labelHeight};
            display: grid;
            grid-template-columns: ${sheetColumns};
            column-gap: ${preset.columnGap};
        }

        .sample-label {
            width: ${preset.labelWidth};
            height: ${preset.labelHeight};
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 0.6mm;
            overflow: hidden;
            padding: ${getLabelPadding(presetName)};
        }

        .sample-id {
            font-family: "Courier New", monospace;
            font-size: ${getSampleIdFontSize(presetName)};
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: clip;
        }

        .barcode {
            min-height: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .barcode svg {
            width: 100%;
            height: 100%;
            display: block;
        }

        .sample-label[data-compact-vertical="true"] {
            grid-template-rows: auto auto auto;
            align-content: center;
            row-gap: 0.45mm;
        }

        .sample-label[data-compact-vertical="true"] .barcode svg {
            height: auto;
        }

        .meta {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 0.8mm;
            font-size: ${getMetaFontSize(presetName)};
            font-weight: 600;
            line-height: 1.2;
            padding-top: 0.2mm;
            white-space: nowrap;
        }

        .meta.compact {
            font-size: ${getCompactMetaFontSize(presetName)};
            gap: 0.5mm;
        }

        .meta span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <main class="label-sheet">${labelCopies}
    </main>
</body>
</html>`
}
