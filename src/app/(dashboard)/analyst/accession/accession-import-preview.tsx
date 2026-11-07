'use client'

// Accession-only, memory-held file/preview UI; server parsing and authority stay behind api-client.
import { useEffect, useId, useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { createAccessionPreviewClient, confirmAccessionClient, fetchAccessionReceiptSamplesClient } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys, searchKeys } from '@/types/query-keys'
import type { AccessionConfirmationStatus, AccessionReceiptSamples } from '@/lib/accession-preview/http-contract'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FormDialogContent } from '@/components/ui/form-dialog-content'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SampleIdCell } from '@/components/sample-grid/cells/SampleIdCell'
import { previewResponseSchema, PreviewResults, type PreviewResponse } from './accession-import-results'

const unavailable = 'Chưa thể xem trước tệp. Vui lòng kiểm tra đăng nhập và quyền tiếp nhận, sau đó thử lại.'
const freshPreview = 'Lần xem trước không còn dùng được. Vui lòng tạo xem trước mới.'
type Outcome = AccessionConfirmationStatus | { state: 'denied'; batchId: string }
type Confirmation = { outcome: Outcome; samples?: AccessionReceiptSamples; idsError?: boolean }

export function AccessionImportPreview() {
    const [open, setOpen] = useState(false)
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
    const [confirming, setConfirming] = useState(false)
    // ponytail: dialog lifetime only; Phase 3 adds status recovery after navigation/refresh.
    const attempt = useRef<object | null>(null)
    const queryClient = useQueryClient()
    useEffect(() => () => { attempt.current = null }, [])

    async function confirm(batchId: string, file: File) {
        if (attempt.current) return
        const token = {}
        attempt.current = token
        setConfirming(true)
        setConfirmation({ outcome: { state: 'processing', batchId } })
        let outcome: Outcome
        try { outcome = await confirmAccessionClient(batchId, file, true) }
        catch (error) {
            const denied = error instanceof Error && /^(Bạn không có quyền truy cập lần nhập này\.|Phiên đăng nhập)/.test(error.message)
            outcome = { state: denied ? 'denied' : 'unknown', batchId }
        }
        // Query caches can outlive this dialog/header; committed success still refreshes them.
        if (outcome.state === 'succeeded') {
            void queryClient.invalidateQueries({ queryKey: sampleKeys.all }).catch(() => {})
            void queryClient.invalidateQueries({ queryKey: searchKeys.all }).catch(() => {})
        }
        if (attempt.current !== token) return
        setConfirming(false)
        setConfirmation({ outcome })
        if (outcome.state !== 'succeeded') {
            if (!['unknown', 'processing', 'preparing'].includes(outcome.state)) attempt.current = null
            return
        }
        try {
            const samples = await fetchAccessionReceiptSamplesClient(batchId)
            if (attempt.current === token) setConfirmation({ outcome, samples })
        } catch {
            if (attempt.current === token) setConfirmation({ outcome, idsError: true })
        }
    }

    function startNewFile() { attempt.current = null; setConfirmation(null) }
    const outcome = confirmation?.outcome
    const blocked = outcome && ['succeeded', 'unknown', 'processing', 'preparing'].includes(outcome.state)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <FileUp className="h-4 w-4" aria-hidden="true" />
                    Nhập từ Excel
                </Button>
            </DialogTrigger>
            {open && (blocked && confirmation
                ? <ConfirmationContent confirmation={confirmation} pending={confirming} onNewFile={startNewFile} />
                : <PreviewContent onConfirm={confirm} onNewFile={startNewFile}
                    rejection={outcome?.state === 'denied'
                        ? 'Vui lòng kiểm tra đăng nhập và quyền tiếp nhận, sau đó tạo xem trước mới.'
                        : outcome ? freshPreview : undefined} />)}
        </Dialog>
    )
}

function PreviewContent({ onConfirm, onNewFile, rejection }: {
    onConfirm: (batchId: string, file: File) => Promise<void>; onNewFile: () => void; rejection?: string
}) {
    const fileId = useId()
    const fileInput = useRef<HTMLInputElement>(null)
    const request = useRef<AbortController | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [pending, setPending] = useState(false)
    const [result, setResult] = useState<PreviewResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState('')
    const [attested, setAttested] = useState(false)
    const attestationId = useId()

    useEffect(() => () => { request.current?.abort(); request.current = null }, [])
    useEffect(() => {
        if (!result?.ok) return
        const timer = setTimeout(() => {
            setResult(null); setAttested(false); setError('Lần xem trước đã hết hạn. Vui lòng tạo xem trước mới.')
        }, Math.max(0, new Date(result.expiresAt).getTime() - Date.now()))
        return () => clearTimeout(timer)
    }, [result])

    function clearPreview() {
        request.current?.abort()
        request.current = null
        setPending(false)
        setResult(null)
        setError(null)
        setNotice('')
        setAttested(false)
    }

    function selectFile(selected: File | undefined) {
        clearPreview()
        onNewFile()
        setFile(null)
        if (!selected) return
        if (!/\.xlsx$/i.test(selected.name) || selected.size < 1 || selected.size >= 10000000) {
            setError('Chọn tệp .xlsx không rỗng và nhỏ hơn 10.000.000 byte.')
            return
        }
        setFile(selected)
    }

    function cancelPreview() {
        clearPreview()
        setFile(null)
        if (fileInput.current) fileInput.current.value = ''
        setNotice('Đã dừng chờ xem trước.')
    }

    async function preparePreview(event: React.FormEvent) {
        event.preventDefault()
        if (!file || request.current) return
        const controller = new AbortController()
        request.current = controller
        setPending(true)
        setError(null)
        setResult(null)
        setNotice('')
        try {
            const response = await createAccessionPreviewClient(file, undefined, { signal: controller.signal })
            if (controller.signal.aborted || request.current !== controller) return
            const parsed = previewResponseSchema.safeParse(response)
            if (!parsed.success) throw new Error('INVALID_PREVIEW_RESPONSE')
            if (parsed.data.ok && Date.now() >= new Date(parsed.data.expiresAt).getTime()) {
                setError('Lần xem trước đã hết hạn. Vui lòng tạo xem trước mới.')
                return
            }
            setResult(parsed.data)
            setNotice(parsed.data.ok ? 'Đã xem trước. Chưa tạo mẫu từ tệp.' : 'Tệp có lỗi cần sửa. Chưa tạo mẫu từ tệp.')
        } catch {
            if (!controller.signal.aborted && request.current === controller) setError(unavailable)
        } finally {
            if (request.current === controller) {
                request.current = null
                setPending(false)
            }
        }
    }

    function confirmPreview() {
        if (!file || !result?.ok || !attested) return
        if (Date.now() >= new Date(result.expiresAt).getTime()) {
            setResult(null); setAttested(false); setError('Lần xem trước đã hết hạn. Vui lòng tạo xem trước mới.')
            return
        }
        void onConfirm(result.batchId, file)
    }

    return (
        <FormDialogContent showCloseButton={false}>
            <DialogHeader>
                <DialogTitle>Nhập từ Excel</DialogTitle>
                <DialogDescription>
                    Chọn tệp .xlsx không rỗng, nhỏ hơn 10.000.000 byte (10 MB thập phân). Tệp được kiểm tra trên máy chủ.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={preparePreview} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor={fileId}>Tệp Excel</Label>
                    <Input id={fileId} ref={fileInput} type="file" accept=".xlsx"
                        onChange={event => selectFile(event.target.files?.[0])} />
                </div>
                {(error || rejection) && <Alert variant="destructive"><AlertDescription>{error || rejection}</AlertDescription></Alert>}
                <p role="status" className="text-sm text-muted-foreground">{pending ? 'Đang kiểm tra tệp…' : notice}</p>
                {result && <PreviewResults result={result} />}
                {result?.ok && <div className="flex items-start gap-2">
                    <Checkbox id={attestationId} checked={attested} onCheckedChange={checked => setAttested(checked === true)} />
                    <Label htmlFor={attestationId} className="leading-relaxed">Tôi xác nhận tất cả mẫu đã được lấy và đạt chất lượng.</Label>
                </div>}
                <DialogFooter className="flex-wrap gap-2">
                    <DialogClose asChild><Button type="button" variant="outline">Đóng</Button></DialogClose>
                    {pending && <Button type="button" variant="outline" onClick={cancelPreview}>Hủy xem trước</Button>}
                    <Button type="submit" disabled={!file || pending} aria-busy={pending}>
                        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {pending ? 'Đang xem trước…' : 'Xem trước'}
                    </Button>
                    {result?.ok && <Button type="button" disabled={!attested || pending} onClick={confirmPreview}>Xác nhận nhập</Button>}
                </DialogFooter>
            </form>
        </FormDialogContent>
    )
}

function ConfirmationContent({ confirmation, pending, onNewFile }: {
    confirmation: Confirmation; pending: boolean; onNewFile: () => void
}) {
    const { outcome, samples, idsError } = confirmation
    return (
        <FormDialogContent showCloseButton={false}>
            <DialogHeader>
                <DialogTitle>Nhập từ Excel</DialogTitle>
                <DialogDescription>Kết quả xác nhận của lần nhập.</DialogDescription>
            </DialogHeader>
            {outcome.state === 'succeeded' ? <section className="space-y-3">
                <h3 className="font-semibold">Đã nhập thành công</h3>
                <p className="break-all text-sm">{outcome.receipt.batch_id}</p>
                <p className="text-sm">Thời điểm xác nhận: {new Date(outcome.receipt.confirmation_received_at).toLocaleString('vi-VN')}.</p>
                <div className="flex flex-wrap gap-3 text-sm">
                    <span>{outcome.receipt.client_count} khách hàng</span><span>{outcome.receipt.sample_count} mẫu</span>
                    <span>{outcome.receipt.assignment_count} chỉ định</span><span>{outcome.receipt.create_count} tạo mới</span>
                    <span>{outcome.receipt.reuse_count} dùng lại</span>
                </div>
                {idsError && <Alert><AlertDescription>Đã nhập thành công; chưa thể tải mã mẫu đã nhập. Kết quả nhập vẫn được giữ nguyên.</AlertDescription></Alert>}
                {!samples && !idsError && <p role="status" className="text-sm">Đang tải mã mẫu đã nhập…</p>}
                {samples && <ul className="space-y-2 text-sm">{samples.samples.map(sample => (
                    <li key={sample.sampleId} className="break-all border-b pb-2">
                        <p>Dòng {sample.row}</p><SampleIdCell value={sample.officialSampleIdentifier} />
                    </li>
                ))}</ul>}
                <Button type="button" variant="outline" onClick={onNewFile}>Nhập tệp khác</Button>
            </section> : <p role="status" className="text-sm">
                {pending ? 'Đang xác nhận lần nhập…' : 'Chưa rõ kết quả xác nhận. Chưa thể chọn tệp mới cho lần nhập này.'}
            </p>}
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Đóng</Button></DialogClose>
                {pending && <Button type="button" disabled aria-busy="true"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Đang xác nhận…</Button>}
            </DialogFooter>
        </FormDialogContent>
    )
}
