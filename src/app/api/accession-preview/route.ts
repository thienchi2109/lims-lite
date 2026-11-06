// Analyst-only, bounded in-memory multipart admission; no source or payload is retained.
import { z } from 'zod'
import { AdmissionError, authorizeAccessionRequest, readAccessionForm, readAccessionSource } from '@/lib/accession-preview/http'
import { prepareAccessionPreview, readPreviewConfiguration } from '@/lib/accession-preview/server'
import { awaitPreviewOperation, checkPreviewDeadline } from '@/lib/accession-preview/cancellation'
import { isAllowedOrigin } from '@/app/api/client-actions/route-helpers'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json; charset=utf-8' }
const response = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers })
const failure = (error: string, status: number) => response({ error }, status)
async function readEnvelope(request: Request, maxBytes: number, signal: AbortSignal, deadline: number) {
    const form = await readAccessionForm(request, maxBytes, signal, deadline)
    const keys = [...form.keys()]
    if (keys.some(key => key !== 'file' && key !== 'retryOfBatchId') || form.getAll('file').length !== 1 || form.getAll('retryOfBatchId').length > 1) {
        throw new AdmissionError(400, 'Chỉ được gửi một tệp Excel và mã lần xem trước cần thử lại.')
    }
    const retry = form.get('retryOfBatchId')
    if (retry !== null && (typeof retry !== 'string' || !z.string().uuid().safeParse(retry).success)) {
        throw new AdmissionError(400, 'Tệp Excel hoặc mã lần xem trước không hợp lệ.')
    }
    return { source: await readAccessionSource(form.get('file'), signal, deadline), retryOf: retry as string | null }
}

export async function POST(request: Request) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = performance.now()
    let deadline: number | undefined
    const controller = new AbortController()
    const disconnect = () => controller.abort()
    request.signal.addEventListener('abort', disconnect, { once: true })
    if (request.signal.aborted) disconnect()
    const signal = controller.signal
    const wait = <T>(operation: PromiseLike<T>) => awaitPreviewOperation(operation, signal, deadline)
    try {
        if (!isAllowedOrigin(request)) return failure('Yêu cầu không được phép.', 403)
        // No default timeout: absent measured policy disables this endpoint before content is read.
        const config = readPreviewConfiguration()
        deadline = startedAt + config.policy.request.timeoutMs
        timer = setTimeout(() => controller.abort(), Math.max(0, deadline - performance.now()))
        await authorizeAccessionRequest(signal, deadline)
        const { source, retryOf } = await readEnvelope(request, config.policy.request.maxBytes, signal, deadline)
        checkPreviewDeadline(signal, deadline)
        const preview = await wait(prepareAccessionPreview(source, retryOf ?? undefined, signal, deadline))
        const serialized = JSON.stringify(preview)
        // Defense in depth; orchestration admits the complete success response before sealing.
        if (Buffer.byteLength(serialized, 'utf8') > config.policy.request.maxResponseBytes) throw new Error('ACCESSION_PREVIEW_RESPONSE_LIMIT')
        checkPreviewDeadline(signal, deadline)
        return new Response(serialized, { status: preview.ok ? 200 : 422, headers })
    } catch (error) {
        if (signal.aborted || (deadline !== undefined && performance.now() >= deadline) || (error instanceof DOMException && error.name === 'TimeoutError')) return failure('Yêu cầu đã bị hủy hoặc quá thời gian xử lý. Chưa thể xác nhận trạng thái xem trước.', 408)
        if (error instanceof AdmissionError) return failure(error.message, error.status)
        return failure('Chưa thể xem trước tệp Excel. Vui lòng thử lại sau.', 503)
    } finally {
        clearTimeout(timer)
        controller.abort()
        request.signal.removeEventListener('abort', disconnect)
    }
}
