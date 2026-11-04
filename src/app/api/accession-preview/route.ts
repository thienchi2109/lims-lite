// Analyst-only, bounded in-memory multipart admission; no source or payload is retained.
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { decodeJwtPayload } from '@/lib/jwt'
import { shouldRequireManagerStepUp } from '@/lib/manager-email-otp/guards'
import { prepareAccessionPreview, readPreviewConfiguration } from '@/lib/accession-preview/server'
import { awaitPreviewOperation, checkPreviewDeadline } from '@/lib/accession-preview/cancellation'
import { isAllowedOrigin } from '@/app/api/client-actions/route-helpers'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json; charset=utf-8' }
const response = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers })
const failure = (error: string, status: number) => response({ error }, status)
class AdmissionError extends Error {
    constructor(readonly status: number, message: string) { super(message) }
}

async function readEnvelope(request: Request, maxBytes: number, signal: AbortSignal, deadline: number) {
    const type = request.headers.get('Content-Type') ?? ''
    if (!/^multipart\/form-data\s*;/i.test(type) || !request.body) throw new AdmissionError(400, 'Vui lòng gửi một tệp Excel theo mẫu.')
    const reader = request.body.getReader(), chunks: Uint8Array[] = []
    let size = 0, complete = false
    const cancel = () => { void reader.cancel().catch(() => {}) }
    signal.addEventListener('abort', cancel, { once: true })
    try {
        while (true) {
            const chunk = await awaitPreviewOperation(reader.read(), signal, deadline)
            if (chunk.done) { complete = true; break }
            size += chunk.value.byteLength
            if (size > maxBytes) throw new AdmissionError(413, 'Tệp vượt giới hạn xử lý an toàn.')
            // Copy only admitted bytes; a transport chunk may reference a larger backing buffer.
            chunks.push(Uint8Array.from(chunk.value))
        }
    } finally {
        if (!complete) cancel()
        signal.removeEventListener('abort', cancel)
        reader.releaseLock()
    }
    checkPreviewDeadline(signal, deadline)
    const bytes = Buffer.concat(chunks, size)
    let form: FormData
    try {
        form = await awaitPreviewOperation(new Request(request.url, { method: 'POST', headers: { 'Content-Type': type }, body: bytes }).formData(), signal, deadline)
    } catch {
        checkPreviewDeadline(signal, deadline)
        throw new AdmissionError(400, 'Nội dung tải lên không hợp lệ.')
    }
    const keys = [...form.keys()]
    if (keys.some(key => key !== 'file' && key !== 'retryOfBatchId') || form.getAll('file').length !== 1 || form.getAll('retryOfBatchId').length > 1) {
        throw new AdmissionError(400, 'Chỉ được gửi một tệp Excel và mã lần xem trước cần thử lại.')
    }
    const file = form.get('file'), retry = form.get('retryOfBatchId')
    if (!(file instanceof File) || file.size === 0 || (retry !== null && (typeof retry !== 'string' || !z.string().uuid().safeParse(retry).success))) {
        throw new AdmissionError(400, 'Tệp Excel hoặc mã lần xem trước không hợp lệ.')
    }
    if (file.size >= 10000000) throw new AdmissionError(413, 'Tệp XLSX phải nhỏ hơn 10.000.000 bytes.')
    return { source: new Uint8Array(await awaitPreviewOperation(file.arrayBuffer(), signal, deadline)), retryOf: retry as string | null }
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
        const supabase = await wait(createClient())
        const { data: { user }, error } = await wait(supabase.auth.getUser())
        if (error || !user) return failure('Vui lòng đăng nhập để xem trước tệp Excel.', 401)
        const { data: profile, error: profileError } = await wait(supabase.from('users')
            .select('role, deleted_at, can_access_confidential, manager_otp_settings(updated_at)').eq('id', user.id).abortSignal(signal).single())
        if (profileError || profile?.role !== 'analyst' || profile.deleted_at !== null) return failure('Bạn không có quyền xem trước tệp Excel.', 403)
        const { data: { session } } = await wait(supabase.auth.getSession())
        const payload = session?.access_token ? decodeJwtPayload<{ session_id?: string; sid?: string }>(session.access_token) : null
        const settings = profile.manager_otp_settings as { updated_at?: string | null } | { updated_at?: string | null }[] | null
        if (await wait(shouldRequireManagerStepUp({ userId: user.id, role: profile.role, can_access_confidential: profile.can_access_confidential,
            sessionId: payload?.session_id ?? payload?.sid, otpEmailUpdatedAt: (Array.isArray(settings) ? settings[0]?.updated_at : settings?.updated_at) ?? 'unconfigured',
        }, await wait(cookies())))) return failure('Vui lòng xác thực OTP email trước khi xem trước tệp Excel.', 403)
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
