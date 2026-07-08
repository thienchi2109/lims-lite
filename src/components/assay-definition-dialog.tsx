'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { LabSpecialty } from '@/types'
import { useAssayDefinitionForm } from './hooks/use-assay-definition-form'
import { AssayDefinitionFields } from './assay-definition-dialog/assay-definition-fields'
import { AssayDefinition, AssayFormMode } from './assay-definition-dialog/types'

const EMPTY_SPECIALTIES: LabSpecialty[] = []

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: AssayFormMode
  assay?: AssayDefinition
  specialties?: LabSpecialty[]
  onCreated?: (assay: AssayDefinition) => void
  onUpdated?: (assay: AssayDefinition) => void
}

export function AssayDefinitionDialog({
  open,
  onOpenChange,
  mode,
  assay,
  specialties = EMPTY_SPECIALTIES,
  onCreated,
  onUpdated,
}: Props) {
  const isViewMode = mode === 'view'
  const [createdSpecialties, setCreatedSpecialties] = useState<LabSpecialty[]>(EMPTY_SPECIALTIES)
  const availableSpecialties = [...specialties]

  createdSpecialties.forEach((specialty) => {
    if (!availableSpecialties.some((existing) => existing.id === specialty.id)) {
      availableSpecialties.push(specialty)
    }
  })

  availableSpecialties.sort((a, b) => a.display_order - b.display_order)

  const handleClose = () => {
    if (!isPending) {
      resetForm()
      onOpenChange(false)
    }
  }

  const {
    form,
    isPending,
    methodNameSuggestions,
    loadingMethodNameSuggestions,
    loadMethodNameSuggestions,
    initializeForm,
    resetForm,
    onSubmit,
  } = useAssayDefinitionForm({
    mode: isViewMode ? 'edit' : mode,
    assay,
    onCreated,
    onUpdated,
    onClose: handleClose,
  })

  useEffect(() => {
    if (open && !isViewMode) {
      loadMethodNameSuggestions()
    }
  }, [open, isViewMode, loadMethodNameSuggestions])

  // Initialize form when editing
  useEffect(() => {
    if (mode === 'edit' && assay) {
      initializeForm(assay)
    } else if (mode === 'create') {
      resetForm()
    }
  }, [mode, assay, open, initializeForm, resetForm])

  const handleSpecialtyCreated = (specialty: LabSpecialty) => {
    setCreatedSpecialties((prev) =>
      prev.some((existing) => existing.id === specialty.id)
        ? prev
        : [...prev, specialty]
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? 'Thêm chỉ tiêu xét nghiệm'
              : isViewMode
                ? 'Chi tiết chỉ tiêu xét nghiệm'
                : 'Sửa chỉ tiêu xét nghiệm'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Nhập thông tin chỉ tiêu xét nghiệm mới'
              : isViewMode
                ? 'Xem thông tin chi tiết của chỉ tiêu xét nghiệm'
                : 'Cập nhật thông tin chỉ tiêu xét nghiệm'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isViewMode ? (
            <AssayDefinitionFields
              mode={mode}
              form={form}
              assay={assay}
              specialties={availableSpecialties}
              onSpecialtyCreated={handleSpecialtyCreated}
              methodNameSuggestions={methodNameSuggestions}
              loadingMethodNameSuggestions={loadingMethodNameSuggestions}
              disabled={isPending}
            />
          ) : (
            <form id="assay-form" onSubmit={onSubmit}>
              <AssayDefinitionFields
                mode={mode}
                form={form}
                assay={assay}
                specialties={availableSpecialties}
                onSpecialtyCreated={handleSpecialtyCreated}
                methodNameSuggestions={methodNameSuggestions}
                loadingMethodNameSuggestions={loadingMethodNameSuggestions}
                disabled={isPending}
              />
            </form>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            {isViewMode ? 'Đóng' : 'Hủy'}
          </Button>
          {!isViewMode && (
            <Button type="submit" form="assay-form" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Tạo' : 'Cập nhật'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
