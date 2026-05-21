import bwipjs from 'bwip-js/browser'
import type { SampleWithUser } from '@/types'

export type SampleLabelPreset = 'small-tube' | 'container'

interface SampleLabelOptions {
    preset?: SampleLabelPreset
}

const LABEL_PRESETS: Record<SampleLabelPreset, {
    width: string
    height: string
    barcodeHeight: number
}> = {
    'small-tube': {
        width: '40mm',
        height: '15mm',
        barcodeHeight: 7,
    },
    container: {
        width: '50mm',
        height: '25mm',
        barcodeHeight: 11,
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

function formatReceivedAt(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${day}/${month} ${hours}:${minutes}`
}

function getReceiverInitials(name: string | null | undefined) {
    if (!name) return ''

    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 4)
}

function renderBarcodeSvg(sampleId: string, height: number) {
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
    sample: SampleWithUser,
    options: SampleLabelOptions = {},
) {
    const presetName = options.preset ?? 'small-tube'
    const preset = LABEL_PRESETS[presetName]
    const sampleId = sample.sample_id
    const sampleType = sample.type ?? ''
    const receivedAt = formatReceivedAt(sample.received_at)
    const receiver = presetName === 'container'
        ? sample.received_by_name ?? ''
        : getReceiverInitials(sample.received_by_name)
    const barcodeSvg = renderBarcodeSvg(sampleId, preset.barcodeHeight)

    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8" />
    <title>Nhãn barcode - ${escapeHtml(sampleId)}</title>
    <style>
        @page {
            size: ${preset.width} ${preset.height};
            margin: 0;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            width: ${preset.width};
            height: ${preset.height};
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: Arial, sans-serif;
        }

        .sample-label {
            width: ${preset.width};
            height: ${preset.height};
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 0.6mm;
            overflow: hidden;
            padding: 1mm 1.5mm;
        }

        .sample-id {
            font-family: "Courier New", monospace;
            font-size: ${presetName === 'small-tube' ? '7.5pt' : '9pt'};
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
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

        .meta {
            display: flex;
            min-width: 0;
            align-items: center;
            gap: 1mm;
            font-size: ${presetName === 'small-tube' ? '6pt' : '7pt'};
            font-weight: 600;
            line-height: 1;
            white-space: nowrap;
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
    <section class="sample-label" aria-label="Nhãn barcode mẫu ${escapeHtml(sampleId)}">
        <div class="sample-id">${escapeHtml(sampleId)}</div>
        <div class="barcode">${barcodeSvg}</div>
        <div class="meta">
            <span>${escapeHtml(sampleType)}</span>
            <span>|</span>
            <span>${escapeHtml(receivedAt)}</span>
            <span>|</span>
            <span>${escapeHtml(receiver)}</span>
        </div>
    </section>
</body>
</html>`
}
