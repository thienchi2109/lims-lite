'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type {
  AdjudicateClientCollision,
  ClientLifecycleDetail,
  ClientLifecycleManagerData,
  ClientLifecycleManagerRow,
  CorrectClientIdentity,
} from '@/types'
import {
  adjudicateClientCollisionClient,
  correctClientIdentityClient,
  deactivateClientClient,
  getClientLifecycleDetailManagerClient,
  getClientLifecycleManagerClient,
  restoreClientClient,
} from '@/lib/api-client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ClientIdentityCorrectionDialog,
  ClientLifecycleReasonDialog,
} from '@/components/client-lifecycle-dialogs'
import {
  ClientCollisionAdjudicationDialog,
  type ClientCollisionAdjudicationOption,
} from '@/components/client-collision-adjudication-dialog'
import { ClientLifecycleTable } from '@/components/client-lifecycle-table'

type LifecycleTab = 'active' | 'inactive' | 'collision'
type ReasonDialogState = {
  mode: 'deactivate' | 'restore'
  client: ClientLifecycleManagerRow
} | null
type AdjudicationDialogState = {
  client: ClientLifecycleManagerRow
  candidates: ClientCollisionAdjudicationOption[]
} | null

const PAGE_SIZE = 50

export function ClientLifecycleWorkspace({
  initialData,
}: {
  initialData: ClientLifecycleManagerData
}) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<LifecycleTab>('active')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState>(null)
  const [correctionDetail, setCorrectionDetail] =
    useState<ClientLifecycleDetail | null>(null)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [adjudicationDialog, setAdjudicationDialog] =
    useState<AdjudicationDialogState>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRequest = useRef(0)

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    },
    [],
  )

  const visibleClients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi-VN')
    return data.clients.filter((client) => {
      const statusMatches =
        tab === 'collision'
          ? client.collisionReasons.length > 0
          : client.status === tab
      const searchMatches =
        !query ||
        client.name.toLocaleLowerCase('vi-VN').includes(query) ||
        client.maskedIdentity.includes(query) ||
        client.maskedPhone.includes(query)
      return statusMatches && searchMatches
    })
  }, [data.clients, search, tab])

  async function loadLifecycleData(
    nextTab: LifecycleTab,
    nextSearch: string,
    nextPage: number,
  ) {
    const requestId = ++latestRequest.current
    setPending(true)
    setError(null)
    try {
      const response = await getClientLifecycleManagerClient({
        status: nextTab,
        search: nextSearch.trim() || undefined,
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
      })
      if (requestId !== latestRequest.current) return
      setData(response.data)
      setPage(nextPage)
    } catch (loadError) {
      if (requestId !== latestRequest.current) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải danh sách khách hàng',
      )
    } finally {
      if (requestId === latestRequest.current) setPending(false)
    }
  }

  function selectTab(nextTab: LifecycleTab) {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setTab(nextTab)
    void loadLifecycleData(nextTab, search, 0)
  }

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void loadLifecycleData(tab, nextSearch, 0)
    }, 300)
  }

  async function completeMutation(
    operation: () => Promise<unknown>,
    close: () => void,
  ) {
    setPending(true)
    setError(null)
    try {
      await operation()
      close()
      router.refresh()
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Không thể hoàn tất thao tác',
      )
    } finally {
      setPending(false)
    }
  }

  async function openCorrection(client: ClientLifecycleManagerRow) {
    setPending(true)
    setError(null)
    try {
      const response = await getClientLifecycleDetailManagerClient({
        clientId: client.id,
      })
      setCorrectionDetail(response.data)
      setCorrectionOpen(true)
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : 'Không thể tải chi tiết khách hàng',
      )
    } finally {
      setPending(false)
    }
  }

  function openAdjudication(client: ClientLifecycleManagerRow) {
    setAdjudicationDialog({
      client,
      candidates: client.collisionCandidates.map((candidate) => ({
        candidate,
        updatedAt: candidate.updatedAt,
      })),
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={tab}
          onValueChange={(value) => selectTab(value as LifecycleTab)}
        >
          <TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="active">
              Đang hoạt động {data.activeCount}
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Ngừng hoạt động {data.inactiveCount}
            </TabsTrigger>
            <TabsTrigger value="collision">
              Cần xử lý {data.collisionCount}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label="Tìm khách hàng"
            className="pl-9"
            placeholder="Tìm theo tên hoặc thông tin đã ẩn"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
          />
        </div>
      </div>

      <ClientLifecycleTable
        clients={visibleClients}
        showAdjudication={tab === 'collision'}
        pending={pending}
        onCorrect={(client) => void openCorrection(client)}
        onAdjudicate={openAdjudication}
        onDeactivate={(client) =>
          setReasonDialog({ mode: 'deactivate', client })
        }
        onRestore={(client) => setReasonDialog({ mode: 'restore', client })}
      />

      {data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Trang {page + 1} / {Math.ceil(data.total / PAGE_SIZE)}
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Trang trước"
            disabled={pending || page === 0}
            onClick={() => void loadLifecycleData(tab, search, page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Trang sau"
            disabled={
              pending || (page + 1) * PAGE_SIZE >= data.total
            }
            onClick={() => void loadLifecycleData(tab, search, page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {reasonDialog && (
        <ClientLifecycleReasonDialog
          key={`${reasonDialog.mode}-${reasonDialog.client.id}-${reasonDialog.client.updatedAt}`}
          client={reasonDialog.client}
          mode={reasonDialog.mode}
          open
          pending={pending}
          onOpenChange={(open) => {
            if (!open) setReasonDialog(null)
          }}
          onSubmit={async (reason) => {
            const payload = {
              clientId: reasonDialog.client.id,
              expectedUpdatedAt: reasonDialog.client.updatedAt,
              reason,
            }
            await completeMutation(
              () =>
                reasonDialog.mode === 'deactivate'
                  ? deactivateClientClient(payload)
                  : restoreClientClient(payload),
              () => setReasonDialog(null),
            )
          }}
        />
      )}

      {correctionOpen && correctionDetail && (
        <ClientIdentityCorrectionDialog
          key={`${correctionDetail.id}-${correctionDetail.updatedAt}`}
          detail={correctionDetail}
          open
          pending={pending}
          onOpenChange={(open) => {
            setCorrectionOpen(open)
            if (!open) setCorrectionDetail(null)
          }}
          onSubmit={async (payload: CorrectClientIdentity) => {
            await completeMutation(
              () => correctClientIdentityClient(payload),
              () => {
                setCorrectionOpen(false)
                setCorrectionDetail(null)
              },
            )
          }}
        />
      )}

      {adjudicationDialog && (
        <ClientCollisionAdjudicationDialog
          key={`${adjudicationDialog.client.id}-${adjudicationDialog.client.updatedAt}`}
          client={adjudicationDialog.client}
          candidates={adjudicationDialog.candidates}
          open
          pending={pending}
          onOpenChange={(open) => {
            if (!open) setAdjudicationDialog(null)
          }}
          onSubmit={async (payload: AdjudicateClientCollision) => {
            await completeMutation(
              () => adjudicateClientCollisionClient(payload),
              () => setAdjudicationDialog(null),
            )
          }}
        />
      )}
    </div>
  )
}
