// File-free committed IDs: existing owner/status guards plus session RLS, never a privileged mapping read.
import { createClient } from '@/lib/supabase/server'
import { AdmissionError, authorizeAccessionRequest } from '@/lib/accession-preview/http'
import { getAccessionConfirmationStatus } from '@/lib/accession-preview/status'
import { accessionBatchIdSchema, accessionReceiptSamplesSchema, type AccessionReceiptSamples } from '@/lib/accession-preview/http-contract'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json; charset=utf-8' }
const response = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers })
const failure = (error: string, status: number) => response({ error }, status)

export async function GET(request: Request, context: { params: Promise<{ batchId: string }> }) {
    const parsedId = accessionBatchIdSchema.safeParse((await context.params).batchId)
    if (!parsedId.success) return failure('Mã lần nhập không hợp lệ.', 400)
    const batchId = parsedId.data
    try {
        await authorizeAccessionRequest(request.signal)
        const status = await getAccessionConfirmationStatus(batchId)
        if (status.state !== 'succeeded') return failure('Chưa có mã mẫu từ lần nhập này.', status.state === 'unknown' ? 503 : 409)
        const supabase = await createClient()
        const samples: AccessionReceiptSamples['samples'] = []
        while (samples.length < status.receipt.sample_count) {
            const end = Math.min(samples.length + 1000, status.receipt.sample_count) - 1
            const { data, error } = await supabase.from('accession_import_mappings')
                .select('row_number,sample_id,official_sample_identifier')
                .eq('batch_id', batchId).eq('kind', 'sample').order('row_number', { ascending: true })
                .range(samples.length, end).abortSignal(request.signal)
            if (error || !Array.isArray(data) || data.length === 0 || data.length > end - samples.length + 1) throw new Error('SAMPLE_READ_UNAVAILABLE')
            const page = accessionReceiptSamplesSchema.parse({ batchId, samples: data.map(row => ({
                row: row.row_number, sampleId: row.sample_id, officialSampleIdentifier: row.official_sample_identifier,
            })) })
            samples.push(...page.samples)
        }
        const result = accessionReceiptSamplesSchema.parse({ batchId, samples })
        if (result.samples.length !== status.receipt.sample_count) throw new Error('SAMPLE_READ_INCOMPLETE')
        return response(result, 200)
    } catch (error) {
        if (error instanceof AdmissionError && error.status === 401) return failure('Vui lòng đăng nhập để tra cứu mã mẫu.', 401)
        if (error instanceof AdmissionError || (error instanceof Error && error.message === 'ACCESSION_CONFIRMATION_FORBIDDEN')) {
            return failure('Bạn không có quyền truy cập lần nhập này.', 403)
        }
        return failure('Chưa thể tải mã mẫu đã nhập. Vui lòng thử lại.', 503)
    }
}
