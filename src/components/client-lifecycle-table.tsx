'use client'

import { Ban, Pencil, RotateCcw, Scale } from 'lucide-react'
import type {
  ClientCollisionReason,
  ClientLifecycleManagerRow,
} from '@/types'
import { CLIENT_COLLISION_TYPE_LABELS } from '@/components/client-collision-adjudication-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const collisionLabels: Record<ClientCollisionReason, string> = {
  ...CLIENT_COLLISION_TYPE_LABELS,
  legacy_identity: 'Định danh cũ chưa tin cậy',
  restricted: 'Bằng chứng bị giới hạn',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value))
}

interface ClientLifecycleTableProps {
  clients: ClientLifecycleManagerRow[]
  showAdjudication: boolean
  pending: boolean
  onCorrect: (client: ClientLifecycleManagerRow) => void
  onAdjudicate: (client: ClientLifecycleManagerRow) => void
  onDeactivate: (client: ClientLifecycleManagerRow) => void
  onRestore: (client: ClientLifecycleManagerRow) => void
}

export function ClientLifecycleTable({
  clients,
  showAdjudication,
  pending,
  onCorrect,
  onAdjudicate,
  onDeactivate,
  onRestore,
}: ClientLifecycleTableProps) {
  return (
    <div className="overflow-x-auto border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Định danh</TableHead>
            <TableHead>Số điện thoại</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Mẫu liên kết</TableHead>
            <TableHead className="w-32 text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-28 text-center text-muted-foreground"
              >
                Không có khách hàng phù hợp
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="font-medium">{client.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(client.dateOfBirth)} · {client.gender}
                  </div>
                  {client.collisionReasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {client.collisionReasons.map((reason) => (
                        <Badge key={reason} variant="destructive">
                          {collisionLabels[reason]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {client.maskedIdentity}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {client.maskedPhone}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      client.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {client.status === 'active'
                      ? 'Đang hoạt động'
                      : 'Ngừng hoạt động'}
                  </Badge>
                  {client.deletedAt && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(client.deletedAt)}
                    </div>
                  )}
                </TableCell>
                <TableCell>{client.sampleCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title={`Hiệu chỉnh ${client.name}`}
                      aria-label={`Hiệu chỉnh ${client.name}`}
                      disabled={pending}
                      onClick={() => onCorrect(client)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {showAdjudication &&
                      client.collisionCandidates.length > 0 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title={`Xác nhận xung đột ${client.name}`}
                          aria-label={`Xác nhận xung đột ${client.name}`}
                          disabled={pending}
                          onClick={() => onAdjudicate(client)}
                        >
                          <Scale className="size-4" />
                        </Button>
                      )}
                    {client.status === 'active' ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title={`Ngừng hoạt động ${client.name}`}
                        aria-label={`Ngừng hoạt động ${client.name}`}
                        disabled={pending}
                        onClick={() => onDeactivate(client)}
                      >
                        <Ban className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title={`Khôi phục ${client.name}`}
                        aria-label={`Khôi phục ${client.name}`}
                        disabled={pending}
                        onClick={() => onRestore(client)}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
