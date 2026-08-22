'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type {
  AdjudicateClientCollision,
  ClientCollisionCandidate,
  ClientCollisionDisposition,
  ClientCollisionType,
  ClientLifecycleManagerRow,
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const CLIENT_COLLISION_TYPE_LABELS: Record<
  ClientCollisionType,
  string
> = {
  government_identity: 'Trùng CCCD/CMND',
  phone: 'Trùng số điện thoại',
  name_date_of_birth: 'Trùng tên và ngày sinh',
}

const dispositionLabels: Record<ClientCollisionDisposition, string> = {
  confirmed_distinct: 'Xác nhận là hai người khác nhau',
  correction_required: 'Cần hiệu chỉnh thông tin',
}

interface ClientCollisionAdjudicationDialogProps {
  client: ClientLifecycleManagerRow
  candidates: ClientCollisionAdjudicationOption[]
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: AdjudicateClientCollision) => Promise<void>
}

export type ClientCollisionAdjudicationOption = {
  candidate: ClientCollisionCandidate
  updatedAt: string
}

export function ClientCollisionAdjudicationDialog({
  client,
  candidates,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: ClientCollisionAdjudicationDialogProps) {
  const [relatedClientId, setRelatedClientId] = useState(
    candidates[0]?.candidate.id ?? '',
  )
  const selectedOption = useMemo(
    () =>
      candidates.find(
        (option) => option.candidate.id === relatedClientId,
      ) ?? candidates[0],
    [candidates, relatedClientId],
  )
  const selectedCandidate = selectedOption?.candidate
  const [collisionType, setCollisionType] = useState<ClientCollisionType>(
    selectedCandidate?.collisionReasons[0] ?? 'government_identity',
  )
  const [disposition, setDisposition] =
    useState<ClientCollisionDisposition>('correction_required')
  const [reason, setReason] = useState('')

  const canConfirmDistinct =
    collisionType !== 'government_identity' ||
    selectedCandidate?.evidenceLevel === 'legacy_identity'

  function chooseCandidate(candidateId: string) {
    const candidate = candidates.find(
      (item) => item.candidate.id === candidateId,
    )?.candidate
    const nextType =
      candidate?.collisionReasons[0] ?? 'government_identity'

    setRelatedClientId(candidateId)
    setCollisionType(nextType)
    if (
      nextType === 'government_identity' &&
      candidate?.evidenceLevel !== 'legacy_identity'
    ) {
      setDisposition('correction_required')
    }
  }

  function chooseCollisionType(nextType: ClientCollisionType) {
    setCollisionType(nextType)
    if (nextType === 'government_identity') {
      setDisposition('correction_required')
    }
  }

  const canSubmit =
    Boolean(selectedOption) &&
    Boolean(selectedCandidate?.collisionReasons.includes(collisionType)) &&
    reason.trim().length >= 8 &&
    reason.trim().length <= 500 &&
    (canConfirmDistinct || disposition === 'correction_required')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Xác nhận xử lý xung đột</DialogTitle>
          <DialogDescription>
            Ghi nhận kết luận có kiểm soát; không gộp khách hàng, đổi UUID hoặc
            liên kết lại mẫu và kết quả lịch sử.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="collision-related-client">
              Khách hàng liên quan
            </Label>
            <select
              id="collision-related-client"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={selectedCandidate?.id ?? ''}
              onChange={(event) => chooseCandidate(event.target.value)}
            >
              {candidates.map(({ candidate }) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.maskedIdentity} ·{' '}
                  {candidate.maskedPhone}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collision-type">Loại xung đột</Label>
            <select
              id="collision-type"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={collisionType}
              onChange={(event) =>
                chooseCollisionType(event.target.value as ClientCollisionType)
              }
            >
              {selectedCandidate?.collisionReasons.map((reasonCode) => (
                <option key={reasonCode} value={reasonCode}>
                  {CLIENT_COLLISION_TYPE_LABELS[reasonCode]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collision-disposition">Kết luận xử lý</Label>
            <select
              id="collision-disposition"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={disposition}
              onChange={(event) =>
                setDisposition(
                  event.target.value as ClientCollisionDisposition,
                )
              }
            >
              <option value="correction_required">
                {dispositionLabels.correction_required}
              </option>
              {canConfirmDistinct && (
                <option value="confirmed_distinct">
                  {dispositionLabels.confirmed_distinct}
                </option>
              )}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="collision-reason">Lý do xác nhận</Label>
            <Textarea
              id="collision-reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <div
          aria-label="Tóm tắt xác nhận xung đột"
          className="space-y-1 border px-3 py-3 text-sm"
        >
          <p>{`Khách hàng đang xử lý: ${client.name}`}</p>
          <p>{`Khách hàng liên quan: ${selectedCandidate?.name ?? 'Không xác định'}`}</p>
          <p>{`Loại xung đột: ${CLIENT_COLLISION_TYPE_LABELS[collisionType]}`}</p>
          <p>{`Kết luận: ${dispositionLabels[disposition]}`}</p>
          <p>{`Lý do: ${reason.trim() || 'Chưa nhập'}`}</p>
          <p className="text-muted-foreground">
            Mỗi khách hàng giữ nguyên UUID hiện tại; không gộp khách hàng và
            không liên kết lại lịch sử.
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
            disabled={pending || !canSubmit}
            onClick={() => {
              if (!selectedCandidate || !selectedOption) return
              void onSubmit({
                clientId: client.id,
                relatedClientId: selectedCandidate.id,
                expectedUpdatedAt: client.updatedAt,
                relatedExpectedUpdatedAt: selectedOption.updatedAt,
                collisionType,
                disposition,
                reason: reason.trim(),
              })
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Xác nhận xử lý
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
