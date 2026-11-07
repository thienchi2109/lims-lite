'use client'

// Accession-only, memory-held file/preview UI; server parsing and authority stay behind api-client.
import { useEffect, useId, useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { createAccessionPreviewClient } from '@/lib/api-client'
import { PreviewValidationResponseSchema } from '@/lib/accession-preview/http-contract'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FormDialogContent } from '@/components/ui/form-dialog-content'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const profileSchema = z.strictObject({
    name: z.string(), dateOfBirth: z.string(), governmentIdentityType: z.string().nullable(),
    governmentIdentityValue: z.string().nullable(), gender: z.string().nullable(), phone: z.string().nullable(),
    address: z.string().nullable(), healthInsuranceNum: z.string().nullable(), expiryDate: z.string().nullable(),
})
const count = z.number().int().nonnegative().safe()
// Validate display wire shape only; workbook/business validation belongs to the existing server.
const previewResponseSchema = z.union([PreviewValidationResponseSchema, z.strictObject({
    ok: z.literal(true), batchId: z.string().uuid(), previewCreatedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    counts: z.strictObject({ clients: count, samples: count, assignments: count, create: count, reuse: count }),
    clients: z.array(z.strictObject({ row: z.number().int().positive().safe(), disposition: z.enum(['create', 'reuse']),
        input: profileSchema, existingValues: profileSchema.partial().nullable(), unchangedFields: z.array(profileSchema.keyof()) })),
})])
type PreviewResponse = z.infer<typeof previewResponseSchema>
type ClientProfile = z.infer<typeof profileSchema>
const fieldLabels: Record<keyof ClientProfile, string> = {
    name: 'Họ và tên', dateOfBirth: 'Ngày sinh', governmentIdentityType: 'Loại giấy tờ',
    governmentIdentityValue: 'Số giấy tờ', gender: 'Giới tính', phone: 'Điện thoại', address: 'Địa chỉ',
    healthInsuranceNum: 'Số BHYT', expiryDate: 'Hạn BHYT',
}
const unavailable = 'Chưa thể xem trước tệp. Vui lòng kiểm tra đăng nhập và quyền tiếp nhận, sau đó thử lại.'

export function AccessionImportPreview() {
    const [open, setOpen] = useState(false)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <FileUp className="h-4 w-4" aria-hidden="true" />
                    Nhập từ Excel
                </Button>
            </DialogTrigger>
            {open && <PreviewContent />}
        </Dialog>
    )
}

function PreviewContent() {
    const fileId = useId()
    const fileInput = useRef<HTMLInputElement>(null)
    const request = useRef<AbortController | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [pending, setPending] = useState(false)
    const [result, setResult] = useState<PreviewResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState('')

    useEffect(() => () => { request.current?.abort(); request.current = null }, [])

    function clearPreview() {
        request.current?.abort()
        request.current = null
        setPending(false)
        setResult(null)
        setError(null)
        setNotice('')
    }

    function selectFile(selected: File | undefined) {
        clearPreview()
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
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <p role="status" className="text-sm text-muted-foreground">{pending ? 'Đang kiểm tra tệp…' : notice}</p>
                {result && <PreviewResults result={result} />}
                <DialogFooter className="flex-wrap gap-2">
                    <DialogClose asChild><Button type="button" variant="outline">Đóng</Button></DialogClose>
                    {pending && <Button type="button" variant="outline" onClick={cancelPreview}>Hủy xem trước</Button>}
                    <Button type="submit" disabled={!file || pending} aria-busy={pending}>
                        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {pending ? 'Đang xem trước…' : 'Xem trước'}
                    </Button>
                </DialogFooter>
            </form>
        </FormDialogContent>
    )
}

function ProfileValues({ values }: { values: Partial<ClientProfile> }) {
    return (
        <dl className="space-y-1 text-sm">
            {Object.entries(values).map(([field, value]) => (
                <div key={field} className="break-words">
                    <dt className="inline text-muted-foreground">{fieldLabels[field as keyof ClientProfile]}: </dt>
                    <dd className="inline">{field === 'governmentIdentityType' ? value?.toUpperCase() || '—' : value || '—'}</dd>
                </div>
            ))}
        </dl>
    )
}

function PreviewResults({ result }: { result: PreviewResponse }) {
    if (!result.ok) return (
        <section className="space-y-3">
            <h3 className="font-semibold">Có {result.errors.length} lỗi cần sửa</h3>
            <Table>
                <TableCaption>Lỗi cần sửa trong Excel</TableCaption>
                <TableHeader><TableRow>
                    {['Trang tính', 'Dòng', 'Cột', 'Lý do', 'Cách sửa'].map(label => <TableHead key={label}>{label}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>{result.errors.map((issue, index) => (
                    <TableRow key={index}>
                        <TableCell>{issue.sheet ?? 'Toàn bộ tệp'}</TableCell>
                        <TableCell>{issue.row ?? '—'}</TableCell>
                        <TableCell>{[issue.column, issue.header].filter(Boolean).join(' — ') || '—'}</TableCell>
                        <TableCell className="min-w-48 whitespace-normal break-words">
                            {issue.message}
                            {issue.relatedLocations?.map((location, relatedIndex) => (
                                <p key={relatedIndex} className="mt-1 text-muted-foreground">
                                    Liên quan: {location.sheet ?? 'Tệp'}, dòng {location.row ?? '—'}, cột {location.column ?? location.header ?? '—'}.
                                </p>
                            ))}
                        </TableCell>
                        <TableCell className="min-w-48 whitespace-normal">
                            {/CATALOG|TEMPLATE/.test(issue.code)
                                ? 'Tải template mới, nhập lại dữ liệu và xem trước lại.'
                                : 'Sửa dữ liệu tại vị trí trên theo lý do, lưu tệp rồi chọn lại để xem trước.'}
                        </TableCell>
                    </TableRow>
                ))}</TableBody>
            </Table>
        </section>
    )
    return (
        <section className="space-y-4">
            <h3 className="font-semibold">Kết quả xem trước</h3>
            <div role="region" aria-label="Tổng quan nhập Excel" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>{result.counts.clients} khách hàng</span><span>{result.counts.samples} mẫu</span>
                <span>{result.counts.assignments} chỉ định</span><span>{result.counts.create} tạo mới</span>
                <span>{result.counts.reuse} dùng lại</span>
            </div>
            <p className="text-sm text-muted-foreground">Hết hạn xem trước: {new Date(result.expiresAt).toLocaleString('vi-VN')}.</p>
            <ul className="divide-y rounded-md border px-3">
                {result.clients.map(client => (
                    <li key={client.row} className="space-y-2 py-3">
                        <h4 className="text-sm font-semibold">Khách hàng — dòng {client.row}: {client.disposition === 'create' ? 'Tạo mới' : 'Dùng lại'}</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div><p className="mb-1 text-sm font-medium">Trong Excel</p><ProfileValues values={client.input} /></div>
                            {client.existingValues && <div><p className="mb-1 text-sm font-medium">Đang lưu trên LIMS</p><ProfileValues values={client.existingValues} /></div>}
                        </div>
                        {client.unchangedFields.length > 0 && <p className="text-sm text-muted-foreground">
                            Giữ nguyên trên LIMS: {client.unchangedFields.map(field => fieldLabels[field]).join(', ')}.
                        </p>}
                    </li>
                ))}
            </ul>
        </section>
    )
}
