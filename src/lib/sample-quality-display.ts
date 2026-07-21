export function formatSampleQuality(sampleQuality: boolean | null): string {
    if (sampleQuality === null) {
        return 'Chưa đánh giá'
    }

    return sampleQuality ? 'Đạt' : 'Không đạt'
}
