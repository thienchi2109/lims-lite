'use client'

import { useState } from 'react'
import { Check, History, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AssaySampleTypeCatalogManager } from '@/types'
import {
  createCandidateDecisionDrafts,
  formatVietnameseDate,
  type CompatibilityReviewPayload,
  type CompatibilityAssay,
} from '@/components/assay-sample-type-compatibility-utils'

export function AssaySampleTypeCompatibilityReview({
  assay,
  sampleTypes,
  isBusy,
  isReadOnly,
  onSave,
}: {
  assay: CompatibilityAssay
  sampleTypes: AssaySampleTypeCatalogManager['sampleTypes']
  isBusy: boolean
  isReadOnly: boolean
  onSave: (payload: CompatibilityReviewPayload) => Promise<void>
}) {
  const isInactiveAssay = !assay.isActive
  const [disposition, setDisposition] = useState(
    isInactiveAssay ? 'not_assignable' : assay.disposition,
  )
  const [reviewReason, setReviewReason] = useState(assay.reviewReason ?? '')
  const [selectedSampleTypeIds, setSelectedSampleTypeIds] = useState(
    () => new Set(
      isInactiveAssay
        ? []
        : assay.compatibilities.map((item) => item.sampleTypeId),
    ),
  )
  const [candidateDecisions, setCandidateDecisions] = useState(
    () => createCandidateDecisionDrafts(assay.candidates),
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const sampleTypeById = new Map(
    sampleTypes.map((sampleType) => [sampleType.id, sampleType]),
  )
  const candidateBySampleTypeId = new Map(
    assay.candidates.map((candidate) => [candidate.sampleTypeId, candidate]),
  )
  function updateCandidateDecision(
    candidateId: string,
    decision: 'accepted' | 'rejected',
  ) {
    setCandidateDecisions((current) => ({
      ...current,
      [candidateId]: {
        decision,
        reason:
          current[candidateId].decision === decision
            ? current[candidateId].reason
            : '',
      },
    }))
  }
  function setNotAssignable() {
    setDisposition('not_assignable')
    setSelectedSampleTypeIds(new Set())
    setCandidateDecisions((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, decision]) => [
          id,
          decision.decision === 'accepted'
            ? { ...decision, decision: null }
            : decision,
        ]),
      ),
    )
  }
  function toggleSampleType(sampleTypeId: string, checked: boolean) {
    if (checked) setDisposition('configured')
    setSelectedSampleTypeIds((current) => {
      const next = new Set(current)
      if (checked) next.add(sampleTypeId)
      else next.delete(sampleTypeId)
      return next
    })

    const candidate = candidateBySampleTypeId.get(sampleTypeId)
    if (candidate) {
      updateCandidateDecision(
        candidate.id,
        checked ? 'accepted' : 'rejected',
      )
    }
  }
  function setCandidateDecision(
    candidateId: string,
    sampleTypeId: string,
    decision: 'accepted' | 'rejected',
  ) {
    if (decision === 'accepted') setDisposition('configured')
    setSelectedSampleTypeIds((current) => {
      const next = new Set(current)
      if (decision === 'accepted') next.add(sampleTypeId)
      else next.delete(sampleTypeId)
      return next
    })
    updateCandidateDecision(candidateId, decision)
  }
  function updateCandidateReason(candidateId: string, reason: string) {
    setCandidateDecisions((current) => ({
      ...current,
      [candidateId]: {
        ...current[candidateId],
        reason,
      },
    }))
  }

  async function handleSave() {
    const trimmedReviewReason = reviewReason.trim()
    const effectiveDisposition = isInactiveAssay
      ? 'not_assignable'
      : disposition
    if (!effectiveDisposition) {
      setValidationError('Vui lòng chọn kết luận đánh giá.')
      return
    }
    if (!trimmedReviewReason) {
      setValidationError('Vui lòng nhập lý do đánh giá chỉ tiêu.')
      return
    }
    if (
      effectiveDisposition === 'configured'
      && selectedSampleTypeIds.size === 0
    ) {
      setValidationError('Vui lòng chọn ít nhất một loại mẫu.')
      return
    }

    const decisions = assay.candidates.map((candidate) => ({
      candidateId: candidate.id,
      ...candidateDecisions[candidate.id],
    }))
    if (
      decisions.some(
        (decision) => !decision.decision || !decision.reason.trim(),
      )
    ) {
      setValidationError('Vui lòng quyết định và ghi lý do cho mọi ứng viên.')
      return
    }

    setValidationError(null)
    await onSave({
      assayDefinitionId: assay.assayDefinitionId,
      disposition: effectiveDisposition,
      reviewReason: trimmedReviewReason,
      sampleTypeIds:
        effectiveDisposition === 'configured'
          ? Array.from(selectedSampleTypeIds)
          : [],
      candidateDecisions: decisions.map((decision) => ({
        candidateId: decision.candidateId,
        decision: decision.decision as 'accepted' | 'rejected',
        reason: decision.reason.trim(),
      })),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">
          {assay.importCode}
        </p>
        <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
          {assay.name}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {assay.methodName || 'Chưa khai báo phương pháp'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2" aria-label="Kết luận đánh giá">
        <Button
          type="button"
          variant={disposition === 'configured' ? 'default' : 'outline'}
          aria-pressed={disposition === 'configured'}
          onClick={() => setDisposition('configured')}
          disabled={isBusy || isReadOnly || isInactiveAssay}
        >
          <Check className="size-4" />
          Có thể chỉ định
        </Button>
        <Button
          type="button"
          variant={disposition === 'not_assignable' ? 'destructive' : 'outline'}
          aria-pressed={disposition === 'not_assignable'}
          onClick={setNotAssignable}
          disabled={isBusy || isReadOnly}
        >
          <X className="size-4" />
          Không thể chỉ định
        </Button>
      </div>

      <fieldset
        className="space-y-3"
        disabled={
          disposition === 'not_assignable'
          || isBusy
          || isReadOnly
          || isInactiveAssay
        }
      >
        <legend className="text-sm font-semibold">Loại mẫu tương thích</legend>
        {sampleTypes.map((sampleType) => {
          const compatibility = assay.compatibilities.find(
            (item) => item.sampleTypeId === sampleType.id,
          )
          return (
            <label
              key={sampleType.id}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <Checkbox
                checked={selectedSampleTypeIds.has(sampleType.id)}
                disabled={
                  isReadOnly
                  || isInactiveAssay
                  || (
                    !sampleType.isActive
                    && !selectedSampleTypeIds.has(sampleType.id)
                  )
                }
                onCheckedChange={(checked) =>
                  toggleSampleType(sampleType.id, checked === true)
                }
              />
              <span className="min-w-0 text-sm">
                <span className="block font-medium">
                  {sampleType.name} ({sampleType.importCode})
                </span>
                <span className="text-slate-500">
                  {!sampleType.isActive
                    ? 'Loại mẫu đã ngừng dùng'
                    : compatibility?.provenance === 'historical_candidate'
                      ? 'Nguồn: ứng viên lịch sử'
                      : compatibility
                        ? 'Nguồn: đánh giá thủ công'
                        : 'Chưa chọn'}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {assay.candidates.length > 0 ? (
        <fieldset className="space-y-4" disabled={isBusy || isReadOnly}>
          <legend className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4" />
            Ứng viên từ dữ liệu lịch sử
          </legend>
          {assay.candidates.map((candidate) => {
            const sampleType = sampleTypeById.get(candidate.sampleTypeId)
            const draft = candidateDecisions[candidate.id]
            const sampleTypeName = sampleType?.name ?? 'Loại mẫu không xác định'
            return (
              <div key={candidate.id} className="space-y-3 rounded-md border p-3">
                <div>
                  <p className="font-medium">{sampleTypeName}</p>
                  <p className="text-sm text-slate-500">
                    Nguồn: dữ liệu lịch sử
                  </p>
                  <p className="text-sm text-slate-500">
                    {candidate.observationCount} lần quan sát
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatVietnameseDate(candidate.firstObservedAt)} -{' '}
                    {formatVietnameseDate(candidate.lastObservedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={draft.decision === 'accepted' ? 'default' : 'outline'}
                    aria-label={`Chấp nhận ứng viên ${sampleTypeName}`}
                    disabled={
                      isInactiveAssay
                      || (
                        !sampleType?.isActive
                        && !selectedSampleTypeIds.has(candidate.sampleTypeId)
                      )
                    }
                    onClick={() =>
                      setCandidateDecision(
                        candidate.id,
                        candidate.sampleTypeId,
                        'accepted',
                      )
                    }
                  >
                    Chấp nhận
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={draft.decision === 'rejected' ? 'destructive' : 'outline'}
                    aria-label={`Từ chối ứng viên ${sampleTypeName}`}
                    onClick={() =>
                      setCandidateDecision(
                        candidate.id,
                        candidate.sampleTypeId,
                        'rejected',
                      )
                    }
                  >
                    Từ chối
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`candidate-reason-${candidate.id}`}>
                    Lý do quyết định ứng viên {sampleTypeName}
                  </Label>
                  <Textarea
                    id={`candidate-reason-${candidate.id}`}
                    value={draft.reason}
                    onChange={(event) =>
                      updateCandidateReason(candidate.id, event.target.value)
                    }
                  />
                </div>
              </div>
            )
          })}
        </fieldset>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`review-reason-${assay.assayDefinitionId}`}>
          Lý do đánh giá chỉ tiêu
        </Label>
        <Textarea
          id={`review-reason-${assay.assayDefinitionId}`}
          value={reviewReason}
          onChange={(event) => setReviewReason(event.target.value)}
          disabled={isBusy || isReadOnly}
        />
      </div>

      {validationError ? (
        <p role="alert" className="text-sm text-red-600">
          {validationError}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={handleSave}
        disabled={isBusy || isReadOnly}
      >
        Lưu đánh giá
      </Button>
    </div>
  )
}
