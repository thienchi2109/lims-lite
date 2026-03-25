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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { AssayMethodsList } from './assay-methods-list'
import { LabSpecialty } from '@/types'
import { useAssayDefinitionForm } from './hooks/use-assay-definition-form'
import { SpecialtyField } from './assay-definition-dialog/specialty-field'
import { ValidationRulesFields } from './assay-definition-dialog/validation-rules-fields'
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
    methods,
    loadingMethods,
    loadMethods,
    initializeForm,
    resetForm,
    onSubmit,
  } = useAssayDefinitionForm({
    mode,
    assay,
    onCreated,
    onUpdated,
    onClose: handleClose,
  })

  // Load methods on open in create mode
  useEffect(() => {
    if (open && mode === 'create') {
      loadMethods()
    }
  }, [open, mode, loadMethods])

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
            {mode === 'create' ? 'Thêm chỉ tiêu xét nghiệm' : 'Sửa chỉ tiêu xét nghiệm'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Nhập thông tin chỉ tiêu xét nghiệm mới'
              : 'Cập nhật thông tin chỉ tiêu xét nghiệm'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <form id="assay-form" onSubmit={onSubmit}>
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Tên chỉ tiêu <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="Ví dụ: pH, Độ đục, E.coli"
                  disabled={isPending}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Specialty - Extracted Component */}
              <SpecialtyField
                form={form}
                specialties={availableSpecialties}
                onSpecialtyCreated={handleSpecialtyCreated}
                disabled={isPending}
              />

              {/* Method - Only show in create mode */}
              {mode === 'create' && (
                <div className="space-y-2">
                  <Label htmlFor="method">
                    Phương pháp ban đầu <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.watch('methodId') || ''}
                    onValueChange={(value) => form.setValue('methodId', value)}
                    disabled={isPending || loadingMethods}
                  >
                    <SelectTrigger id="method">
                      <SelectValue placeholder="Chọn phương pháp" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {methods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadingMethods && (
                    <p className="text-xs text-muted-foreground">
                      Đang tải danh sách phương pháp...
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Bạn có thể thêm nhiều phương pháp khác sau khi tạo.
                  </p>
                </div>
              )}

              {/* Units */}
              <div className="space-y-2">
                <Label htmlFor="units">Đơn vị</Label>
                <Input
                  id="units"
                  {...form.register('units')}
                  placeholder="Ví dụ: mg/L, CFU/100mL, NTU"
                  disabled={isPending}
                />
              </div>

              {/* Confidential flag */}
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="isConfidential"
                  checked={form.watch('isConfidential')}
                  onCheckedChange={(checked) => form.setValue('isConfidential', checked === true)}
                  disabled={isPending}
                />
                <div className="space-y-1">
                  <Label htmlFor="isConfidential" className="cursor-pointer">
                    Chỉ tiêu bí mật
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Bật cho các chỉ tiêu HIV hoặc dữ liệu nhạy cảm cần giới hạn truy cập.
                  </p>
                </div>
              </div>

              {/* Validation Rules - Extracted Component */}
              <ValidationRulesFields form={form} disabled={isPending} />
            </div>
          </form>

          {/* Methods Management (Edit Mode Only) */}
          {mode === 'edit' && assay && (
            <div className="border-t pt-6">
              <AssayMethodsList
                assayId={assay.id}
                methods={assay.methods || []}
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            Hủy
          </Button>
          <Button type="submit" form="assay-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Tạo' : 'Cập nhật'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
