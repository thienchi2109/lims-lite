// Shared preview/confirmation request admission. Source stays in bounded request memory only.
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { decodeJwtPayload } from '@/lib/jwt'
import { shouldRequireManagerStepUp } from '@/lib/manager-email-otp/guards'
import { awaitPreviewOperation, checkPreviewDeadline } from './cancellation'

export class AdmissionError extends Error {
    constructor(readonly status: number, message: string) { super(message) }
}

export async function authorizeAccessionRequest(signal: AbortSignal, deadline?: number) {
    const wait = <T>(operation: PromiseLike<T>) => awaitPreviewOperation(operation, signal, deadline)
    const supabase = await wait(createClient())
    const { data: { user }, error } = await wait(supabase.auth.getUser())
    if (error || !user) throw new AdmissionError(401, 'Vui lòng đăng nhập để xử lý tệp Excel.')
    const { data: profile, error: profileError } = await wait(supabase.from('users')
        .select('role, deleted_at, can_access_confidential, manager_otp_settings(updated_at)').eq('id', user.id).abortSignal(signal).single())
    if (profileError || profile?.role !== 'analyst' || profile.deleted_at !== null) throw new AdmissionError(403, 'Bạn không có quyền xử lý tệp Excel.')
    const { data: { session } } = await wait(supabase.auth.getSession())
    const payload = session?.access_token ? decodeJwtPayload<{ session_id?: string; sid?: string }>(session.access_token) : null
    const settings = profile.manager_otp_settings as { updated_at?: string | null } | { updated_at?: string | null }[] | null
    if (await wait(shouldRequireManagerStepUp({ userId: user.id, role: profile.role, can_access_confidential: profile.can_access_confidential,
        sessionId: payload?.session_id ?? payload?.sid, otpEmailUpdatedAt: (Array.isArray(settings) ? settings[0]?.updated_at : settings?.updated_at) ?? 'unconfigured',
    }, await wait(cookies())))) throw new AdmissionError(403, 'Vui lòng xác thực OTP email trước khi xử lý tệp Excel.')
}

export async function readAccessionForm(request: Request, maxBytes: number, signal: AbortSignal, deadline: number) {
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
    try {
        return await awaitPreviewOperation(new Request(request.url, { method: 'POST', headers: { 'Content-Type': type },
            body: Buffer.concat(chunks, size) }).formData(), signal, deadline)
    } catch {
        checkPreviewDeadline(signal, deadline)
        throw new AdmissionError(400, 'Nội dung tải lên không hợp lệ.')
    }
}

export async function readAccessionSource(file: FormDataEntryValue | null, signal: AbortSignal, deadline: number) {
    if (!(file instanceof File) || file.size === 0) throw new AdmissionError(400, 'Tệp Excel không hợp lệ.')
    if (file.size >= 10000000) throw new AdmissionError(413, 'Tệp XLSX phải nhỏ hơn 10.000.000 bytes.')
    return new Uint8Array(await awaitPreviewOperation(file.arrayBuffer(), signal, deadline))
}
