'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  AssaySampleTypeCompatibilityClone,
  AssaySampleTypeCompatibilityPublication,
} from '@/components/assay-sample-type-compatibility-publication'
import { AssaySampleTypeCompatibilityReview } from '@/components/assay-sample-type-compatibility-review'
import {
  createCatalogDiffDetails,
  getCoverageLabel,
  matchesCoverageFilter,
  translateCompatibilityError,
  type CompatibilityReviewPayload,
  type CoverageFilter,
} from '@/components/assay-sample-type-compatibility-utils'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  cloneAssaySampleTypeCatalogRevisionClient,
  getAssaySampleTypeCatalogManagerClient,
  publishAssaySampleTypeCatalogRevisionClient,
  reviewAssaySampleTypeCatalogRevisionClient,
  updateAssaySampleTypeCatalogReviewClient,
} from '@/lib/api-client'
import type { AssaySampleTypeCatalogManager } from '@/types'

type SpecialtyOption = { id: string; name: string }

export function AssaySampleTypeCompatibilityWorkspace({
  initialCatalog,
  sourceCatalog = null,
  specialties = [],
}: {
  initialCatalog: AssaySampleTypeCatalogManager
  sourceCatalog?: AssaySampleTypeCatalogManager | null
  specialties?: SpecialtyOption[]
}) {
  const router = useRouter()
  const [catalog, setCatalog] = useState(initialCatalog)
  const [specialtyId, setSpecialtyId] = useState('all')
  const [coverageFilter, setCoverageFilter] =
    useState<CoverageFilter>('all')
  const [selectedAssayId, setSelectedAssayId] = useState(
    initialCatalog.assays.find((assay) => assay.isActive)?.assayDefinitionId
      ?? initialCatalog.assays[0]?.assayDefinitionId
      ?? null,
  )
  const [isBusy, setIsBusy] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [operationMessage, setOperationMessage] = useState<string | null>(null)
  const specialtyOptions = useMemo(() => {
    const suppliedNames = new Map(
      specialties.map((specialty) => [specialty.id, specialty.name]),
    )
    return Array.from(
      new Set(
        catalog.assays
          .map((assay) => assay.specialtyId)
          .filter((id): id is string => Boolean(id)),
      ),
    ).map((id, index) => ({
      id,
      name: suppliedNames.get(id) ?? `Chuyên khoa ${index + 1}`,
    }))
  }, [catalog.assays, specialties])

  const filteredAssays = useMemo(
    () =>
      catalog.assays.filter(
        (assay) =>
          (specialtyId === 'all' || assay.specialtyId === specialtyId)
          && matchesCoverageFilter(assay, coverageFilter),
      ),
    [catalog.assays, coverageFilter, specialtyId],
  )
  const selectedAssay =
    filteredAssays.find(
      (assay) => assay.assayDefinitionId === selectedAssayId,
    )
    ?? filteredAssays[0]
    ?? null
  const revision = catalog.revision
  const diffDetails = useMemo(
    () => createCatalogDiffDetails(catalog, sourceCatalog),
    [catalog, sourceCatalog],
  )
  async function reloadCatalog() {
    const result = await getAssaySampleTypeCatalogManagerClient(
      revision ? { revisionId: revision.id } : {},
    )
    if (result.data) {
      setCatalog(result.data)
      return true
    }
    setOperationError(translateCompatibilityError(result.error))
    return false
  }
  async function runOperation(
    operation: () => Promise<{ data?: unknown; error?: unknown }>,
    successMessage: string,
  ) {
    setIsBusy(true)
    setOperationError(null)
    setOperationMessage(null)
    try {
      const result = await operation()
      if (result.error) {
        setOperationError(translateCompatibilityError(result.error))
        return
      }
      const reloaded = await reloadCatalog()
      if (reloaded) setOperationMessage(successMessage)
    } catch (error) {
      setOperationError(translateCompatibilityError(error))
    } finally {
      setIsBusy(false)
    }
  }
  async function handleSaveReview(payload: CompatibilityReviewPayload) {
    if (!revision) return
    await runOperation(
      () =>
        updateAssaySampleTypeCatalogReviewClient({
          revisionId: revision.id,
          expectedRevisionUpdatedAt: revision.updatedAt,
          ...payload,
        }),
      'Đã lưu đánh giá chỉ tiêu.',
    )
  }
  async function handleReviewRevision() {
    if (!revision) return
    await runOperation(
      () =>
        reviewAssaySampleTypeCatalogRevisionClient({
          revisionId: revision.id,
          expectedRevisionUpdatedAt: revision.updatedAt,
        }),
      'Đã xác nhận nội dung bản nháp.',
    )
  }
  async function handlePublishRevision(reason: string) {
    if (!revision) return
    await runOperation(
      () =>
        publishAssaySampleTypeCatalogRevisionClient({
          revisionId: revision.id,
          expectedRevisionUpdatedAt: revision.updatedAt,
          publishReason: reason,
        }),
      `Đã xuất bản phiên bản ${revision.revisionNumber}.`,
    )
  }

  async function handleCloneRevision(reason: string) {
    if (!revision || revision.status !== 'published') return
    setIsBusy(true)
    setOperationError(null)
    setOperationMessage(null)
    try {
      const result = await cloneAssaySampleTypeCatalogRevisionClient({
        sourceRevisionNumber: revision.revisionNumber,
        creationReason: reason,
      })
      if (result.error) {
        setOperationError(translateCompatibilityError(result.error))
        return
      }
      setOperationMessage('Đã tạo bản nháp mới.')
      router.refresh()
    } catch (error) {
      setOperationError(translateCompatibilityError(error))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="border-y bg-white dark:bg-slate-950">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">Bản đang làm việc</p>
            <p className="font-semibold">
              {revision
                ? `Phiên bản ${revision.revisionNumber} - ${
                    revision.status === 'draft' ? 'Bản nháp' : 'Đã xuất bản'
                  }`
                : 'Chưa có phiên bản'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Thay đổi cặp tương thích</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">
                Thêm {catalog.diff.addedPairCount} cặp
              </Badge>
              <Badge variant="outline">
                Bỏ {catalog.diff.removedPairCount} cặp
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500">Thay đổi đánh giá</p>
            <p className="font-semibold">
              Thay đổi {catalog.diff.changedReviewCount} đánh giá
            </p>
          </div>
        </div>
      </section>

      <div className="grid min-h-[620px] gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <section className="border bg-white dark:bg-slate-950">
          <div className="grid gap-4 border-b p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="compatibility-specialty">Chuyên khoa</Label>
              <select
                id="compatibility-specialty"
                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                value={specialtyId}
                onChange={(event) => setSpecialtyId(event.target.value)}
              >
                <option value="all">Tất cả chuyên khoa</option>
                {specialtyOptions.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="compatibility-coverage">
                Trạng thái bao phủ
              </Label>
              <select
                id="compatibility-coverage"
                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                value={coverageFilter}
                onChange={(event) =>
                  setCoverageFilter(event.target.value as CoverageFilter)
                }
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="unreviewed">Chưa đánh giá</option>
                <option value="candidate">Còn ứng viên</option>
                <option value="stale">Cần rà soát vòng đời</option>
                <option value="configured">Đã cấu hình</option>
                <option value="not_assignable">Không thể chỉ định</option>
                <option value="inactive">Ngừng dùng</option>
              </select>
            </div>
          </div>

          <div className="border-b px-4 py-3 text-sm text-slate-500">
            {filteredAssays.length} chỉ tiêu
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {filteredAssays.map((assay) => {
              const isSelected =
                assay.assayDefinitionId === selectedAssay?.assayDefinitionId
              return (
                <button
                  key={assay.assayDefinitionId}
                  type="button"
                  className={`flex w-full items-start justify-between gap-3 border-b px-4 py-4 text-left transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-900'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  }`}
                  onClick={() =>
                    setSelectedAssayId(assay.assayDefinitionId)
                  }
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{assay.name}</span>
                    <span className="block text-sm text-slate-500">
                      {assay.importCode} ·{' '}
                      {assay.methodName || 'Chưa khai báo phương pháp'}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {assay.compatibilities.length} loại mẫu tương thích
                    </span>
                  </span>
                  <Badge variant={assay.isActive ? 'secondary' : 'outline'}>
                    {getCoverageLabel(assay)}
                  </Badge>
                </button>
              )
            })}
            {filteredAssays.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Không có chỉ tiêu phù hợp bộ lọc.
              </p>
            ) : null}
          </div>
        </section>

        <section className="border bg-white p-5 dark:bg-slate-950">
          {selectedAssay ? (
            <AssaySampleTypeCompatibilityReview
              key={selectedAssay.assayDefinitionId}
              assay={selectedAssay}
              sampleTypes={catalog.sampleTypes}
              isBusy={isBusy}
              isReadOnly={revision?.status !== 'draft'}
              onSave={handleSaveReview}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Chọn một chỉ tiêu để đánh giá.
            </p>
          )}
        </section>
      </div>

      {operationError ? (
        <p role="alert" className="text-sm text-red-600">
          {operationError}
        </p>
      ) : null}
      {operationMessage ? (
        <p role="status" className="text-sm text-emerald-700">
          {operationMessage}
        </p>
      ) : null}

      {revision?.status === 'draft' ? (
        <AssaySampleTypeCompatibilityPublication
          key={`${revision.updatedAt}:${revision.contentHash ?? 'unreviewed'}`}
          revision={revision}
          diffDetails={diffDetails}
          isBusy={isBusy}
          onReview={handleReviewRevision}
          onPublish={handlePublishRevision}
        />
      ) : revision?.status === 'published' ? (
        <AssaySampleTypeCompatibilityClone
          revisionNumber={revision.revisionNumber}
          isBusy={isBusy}
          onClone={handleCloneRevision}
        />
      ) : null}
    </div>
  )
}
