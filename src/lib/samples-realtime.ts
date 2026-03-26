const LOCAL_SAMPLES_MUTATION_GRACE_MS = 1_500

let lastLocalSamplesMutationAt = 0

export function markLocalSamplesMutation(now = Date.now()) {
    lastLocalSamplesMutationAt = now
}

export function shouldSuppressSamplesRealtimeEcho(now = Date.now()) {
    return now - lastLocalSamplesMutationAt < LOCAL_SAMPLES_MUTATION_GRACE_MS
}

export function resetLocalSamplesMutationTracking() {
    lastLocalSamplesMutationAt = 0
}
