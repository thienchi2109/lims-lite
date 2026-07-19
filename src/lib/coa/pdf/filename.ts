const FALLBACK_SAMPLE_ID = 'MauXetNghiem'
const HO_CHI_MINH_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const coaDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: HO_CHI_MINH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
})

export function sanitizeCoaSampleIdForFilename(sampleId: string): string {
    const safeSampleId = sampleId
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^[._-]+|[._-]+$/g, '')

    return safeSampleId || FALLBACK_SAMPLE_ID
}

export function formatCoaPdfDate(generatedAt: string | Date): string {
    const date = generatedAt instanceof Date
        ? new Date(generatedAt.getTime())
        : new Date(generatedAt)

    if (Number.isNaN(date.getTime())) {
        throw new TypeError('Invalid CoA generated_at timestamp')
    }

    const dateParts = Object.fromEntries(
        coaDateFormatter
            .formatToParts(date)
            .filter(({ type }) => type === 'year' || type === 'month' || type === 'day')
            .map(({ type, value }) => [type, value]),
    )

    return `${dateParts.year}${dateParts.month}${dateParts.day}`
}

export function buildCoaPdfFilename(
    sampleId: string,
    generatedAt: string | Date,
): string {
    const safeSampleId = sanitizeCoaSampleIdForFilename(sampleId)
    const generatedDate = formatCoaPdfDate(generatedAt)

    return `PhieuKetQuaXN-${safeSampleId}-${generatedDate}.pdf`
}
