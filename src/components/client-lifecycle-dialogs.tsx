'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type {
  ClientLifecycleDetail,
  ClientLifecycleManagerRow,
  CorrectClientIdentity,
} from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type LifecycleMode = 'deactivate' | 'restore'

interface ClientLifecycleReasonDialogProps {
  client: ClientLifecycleManagerRow | null
  mode: LifecycleMode
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (reason: string) => Promise<void>
}

export function ClientLifecycleReasonDialog({
  client,
  mode,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: ClientLifecycleReasonDialogProps) {
  const [reason, setReason] = useState('')

  const isDeactivate = mode === 'deactivate'
  const actionLabel = isDeactivate ? 'ngừng hoạt động' : 'khôi phục'
  const currentStatus = isDeactivate ? 'Đang hoạt động' : 'Ngừng hoạt động'
  const nextStatus = isDeactivate ? 'Ngừng hoạt động' : 'Đang hoạt động'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isDeactivate ? 'Ngừng hoạt động khách hàng' : 'Khôi phục khách hàng'}
          </DialogTitle>
          <DialogDescription>
            {client?.name}. Thao tác giữ nguyên UUID và toàn bộ liên kết lịch sử.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`client-lifecycle-${mode}-reason`}>Lý do bắt buộc</Label>
          <Textarea
            id={`client-lifecycle-${mode}-reason`}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <div
          aria-label="Tóm tắt xác nhận vòng đời"
          className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm"
        >
          <p>Trạng thái hiện tại: {currentStatus}</p>
          <p>Trạng thái sau thao tác: {nextStatus}</p>
          <p>Lý do: {reason.trim() || 'Chưa nhập'}</p>
          <p className="text-muted-foreground">
            UUID và toàn bộ liên kết mẫu, kết quả lịch sử được giữ nguyên.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant={isDeactivate ? 'destructive' : 'default'}
            disabled={pending || reason.trim().length < 8}
            onClick={() => void onSubmit(reason.trim())}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Xác nhận {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ClientIdentityCorrectionDialogProps {
  detail: ClientLifecycleDetail
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CorrectClientIdentity) => Promise<void>
}

export function ClientIdentityCorrectionDialog({
  detail,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: ClientIdentityCorrectionDialogProps) {
  const [form, setForm] = useState({
    idCardNum: detail.idCardNum,
    name: detail.name,
    dateOfBirth: detail.dateOfBirth,
    gender: detail.gender,
    phone: detail.phone,
    reason: '',
  })

  const canSubmit = Boolean(
    /^(?:\d{9}|\d{12})$/.test(form.idCardNum) &&
      form.name.trim() &&
      form.dateOfBirth &&
      /^(?:0\d{9,10}|\+84\d{9,10})$/.test(form.phone) &&
      form.phone !== '0000000000' &&
      form.reason.trim().length >= 8,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Hiệu chỉnh định danh khách hàng</DialogTitle>
          <DialogDescription>
            Xác nhận cập nhật cùng UUID; không gộp khách hàng và không thay đổi
            liên kết mẫu/kết quả lịch sử.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client-correction-id-card">Số CCCD/CMND</Label>
            <Input
              id="client-correction-id-card"
              value={form.idCardNum}
              inputMode="numeric"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  idCardNum: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-correction-phone">Số điện thoại</Label>
            <Input
              id="client-correction-phone"
              value={form.phone}
              inputMode="tel"
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="client-correction-name">Họ và tên</Label>
            <Input
              id="client-correction-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-correction-dob">Ngày sinh</Label>
            <Input
              id="client-correction-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dateOfBirth: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-correction-gender">Giới tính</Label>
            <select
              id="client-correction-gender"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={form.gender}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  gender: event.target.value as 'Nam' | 'Nữ' | 'Khác',
                }))
              }
            >
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="client-correction-reason">Lý do bắt buộc</Label>
            <Textarea
              id="client-correction-reason"
              value={form.reason}
              maxLength={500}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div
          aria-label="Tóm tắt xác nhận hiệu chỉnh"
          className="space-y-3 border px-3 py-3 text-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="font-medium">Trước hiệu chỉnh</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-muted-foreground">
                <dt>CCCD/CMND:</dt>
                <dd className="font-mono text-foreground">{detail.idCardNum}</dd>
                <dt>Họ tên:</dt>
                <dd className="text-foreground">{detail.name}</dd>
                <dt>Ngày sinh:</dt>
                <dd className="text-foreground">{detail.dateOfBirth}</dd>
                <dt>Giới tính:</dt>
                <dd className="text-foreground">{detail.gender}</dd>
                <dt>Điện thoại:</dt>
                <dd className="font-mono text-foreground">{detail.phone}</dd>
              </dl>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Sau hiệu chỉnh</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-muted-foreground">
                <dt>CCCD/CMND:</dt>
                <dd className="font-mono text-foreground">{form.idCardNum}</dd>
                <dt>Họ tên:</dt>
                <dd className="text-foreground">
                  {form.name.trim() || 'Chưa nhập'}
                </dd>
                <dt>Ngày sinh:</dt>
                <dd className="text-foreground">
                  {form.dateOfBirth || 'Chưa nhập'}
                </dd>
                <dt>Giới tính:</dt>
                <dd className="text-foreground">{form.gender}</dd>
                <dt>Điện thoại:</dt>
                <dd className="font-mono text-foreground">
                  {form.phone || 'Chưa nhập'}
                </dd>
              </dl>
            </div>
          </div>
          <p>{`Lý do: ${form.reason.trim() || 'Chưa nhập'}`}</p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            disabled={pending || !canSubmit}
            onClick={() => {
              void onSubmit({
                clientId: detail.id,
                expectedUpdatedAt: detail.updatedAt,
                idCardNum: form.idCardNum,
                name: form.name.trim(),
                dateOfBirth: form.dateOfBirth,
                gender: form.gender,
                phone: form.phone,
                reason: form.reason.trim(),
              })
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Lưu hiệu chỉnh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
