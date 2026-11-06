// Owner-only HTTP bridge. Accepted atomic work is never canceled or replayed by transport cleanup.
import { z } from 'zod'
import { isAllowedOrigin } from '@/app/api/client-actions/route-helpers'
import { confirmAccession } from '@/lib/accession-preview/confirm'
import { getAccessionConfirmationStatus, type AccessionConfirmationStatus } from '@/lib/accession-preview/status'
import { readPreviewConfiguration } from '@/lib/accession-preview/server'
import { AdmissionError, authorizeAccessionRequest, readAccessionForm, readAccessionSource } from '@/lib/accession-preview/http'
import { awaitPreviewOperation, checkPreviewDeadline } from '@/lib/accession-preview/cancellation'

export const runtime = 'nodejs'
type Context = { params: Promise<{ batchId: string }> }
const headers = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json; charset=utf-8' }
const response = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers })
const failure = (error: string, status: number) => response({ error }, status)
function outcome(result: AccessionConfirmationStatus) {
    if (result.state === 'unknown') return response(result, 503)
    if (['processing', 'preparing'].includes(result.state)) return response(result, 202)
    if (['failed', 'expired', 'rejected'].includes(result.state)) return response(result, 422)
    return response(result, 200)
}
async function handle(request: Request, context: Context, confirming: boolean) {
    const startedAt = performance.now()
    let timer: ReturnType<typeof setTimeout> | undefined, deadline: number | undefined, dispatched = false, batchId: string | undefined
    const controller = new AbortController(), signal = controller.signal
    const disconnect = () => { if (!dispatched) controller.abort() }
    request.signal.addEventListener('abort', disconnect, { once: true })
    if (request.signal.aborted) disconnect()
    try {
        if (confirming && !isAllowedOrigin(request)) return failure('Yêu cầu không được phép.', 403)
        const parsed = z.string().uuid().safeParse((await context.params).batchId)
        if (!parsed.success) return failure('Mã lần nhập không hợp lệ.', 400)
        batchId = parsed.data
        await authorizeAccessionRequest(signal)
        const status = await awaitPreviewOperation(getAccessionConfirmationStatus(batchId), signal)
        if (!confirming || status.state !== 'preview_ready') return outcome(status)
        // Only fresh confirmations require measured source admission policy and workbook bytes.
        const config = readPreviewConfiguration()
        deadline = startedAt + config.policy.request.timeoutMs
        timer = setTimeout(() => controller.abort(), Math.max(0, deadline - performance.now()))
        checkPreviewDeadline(signal, deadline)
        const form = await readAccessionForm(request, config.policy.request.maxBytes, signal, deadline)
        if ([...form.keys()].some(key => key !== 'file' && key !== 'acceptableQuality') || form.getAll('file').length !== 1
            || form.getAll('acceptableQuality').length !== 1 || form.get('acceptableQuality') !== 'true') {
            throw new AdmissionError(400, 'Cần một tệp Excel gốc và xác nhận tất cả mẫu đã lấy, đạt chất lượng.')
        }
        const source = await readAccessionSource(form.get('file'), signal, deadline)
        checkPreviewDeadline(signal, deadline)
        dispatched = true
        // The signal bounds HTTP waiting only; never pass it into the existing atomic adapter.
        const result = await awaitPreviewOperation(confirmAccession(batchId, source, true), signal, deadline)
        return outcome(result)
    } catch (error) {
        if (dispatched) return outcome({ state: 'unknown', batchId: batchId! })
        if (error instanceof AdmissionError) return failure(error.message, error.status)
        if (error instanceof Error && error.message === 'ACCESSION_CONFIRMATION_FORBIDDEN') return failure('Bạn không có quyền truy cập lần nhập này.', 403)
        if (signal.aborted || (deadline !== undefined && performance.now() >= deadline)) return failure('Yêu cầu đã bị hủy trước khi gửi xác nhận.', 408)
        return failure('Chưa thể tra cứu hoặc xác nhận lần nhập. Vui lòng tra cứu lại trạng thái.', 503)
    } finally {
        clearTimeout(timer)
        controller.abort()
        request.signal.removeEventListener('abort', disconnect)
    }
}
export async function GET(request: Request, context: Context) { return handle(request, context, false) }
export async function POST(request: Request, context: Context) { return handle(request, context, true) }
