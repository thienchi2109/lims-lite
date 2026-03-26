const LOCAL_SAMPLES_MUTATION_GRACE_MS = 1_500

const pendingLocalSampleEchoes = new Map<string, number>()

export function markLocalSamplesMutation(sampleId: string, now = Date.now()) {
    pendingLocalSampleEchoes.set(sampleId, now + LOCAL_SAMPLES_MUTATION_GRACE_MS)
}

export function shouldSuppressSamplesRealtimeEcho(
    sampleId: string | null | undefined,
    now = Date.now(),
) {
    if (!sampleId) return false

    const expiresAt = pendingLocalSampleEchoes.get(sampleId)

    if (!expiresAt) {
        return false
    }

    if (expiresAt <= now) {
        pendingLocalSampleEchoes.delete(sampleId)
        return false
    }

    pendingLocalSampleEchoes.delete(sampleId)
    return true
}

export function resetLocalSamplesMutationTracking() {
    pendingLocalSampleEchoes.clear()
}
