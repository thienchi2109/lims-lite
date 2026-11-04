// Request-local cancellation also fences transports that ignore AbortSignal or complete late.
export function checkPreviewDeadline(signal?: AbortSignal, deadline?: number) {
    signal?.throwIfAborted()
    if (deadline !== undefined && performance.now() >= deadline) throw new DOMException('ACCESSION_PREVIEW_DEADLINE', 'TimeoutError')
}

export async function awaitPreviewOperation<T>(operation: PromiseLike<T>, signal?: AbortSignal, deadline?: number): Promise<T> {
    try { checkPreviewDeadline(signal, deadline) }
    catch (error) {
        // An eager Promise already runs; observe its failure without starting lazy RPC thenables.
        if (operation instanceof Promise) void operation.catch(() => {})
        throw error
    }
    if (!signal) {
        const result = await operation
        checkPreviewDeadline(signal, deadline)
        return result
    }
    let onAbort!: () => void
    const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason)
        signal.addEventListener('abort', onAbort, { once: true })
    })
    try {
        const result = await Promise.race([operation, aborted])
        checkPreviewDeadline(signal, deadline)
        return result
    } finally { signal.removeEventListener('abort', onAbort) }
}
