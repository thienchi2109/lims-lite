'use client'

import { UseFormReturn } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LabSpecialty } from '@/types'
import { getAssayDefinitionMethodName } from '@/lib/assay-method-name'
import { MethodNameField } from './method-name-field'
import { SpecialtyField } from './specialty-field'
import { ValidationRulesFields } from './validation-rules-fields'
import {
  AssayDefinition,
  AssayFormMode,
  AssayFormValues,
  RawValidationRules,
} from './types'

type Props = {
  mode: AssayFormMode
  form: UseFormReturn<AssayFormValues>
  assay?: AssayDefinition
  specialties: LabSpecialty[]
  onSpecialtyCreated: (specialty: LabSpecialty) => void
  methodNameSuggestions: string[]
  loadingMethodNameSuggestions: boolean
  disabled?: boolean
}

const DATA_TYPE_LABELS: Record<string, string> = {
  numeric: 'Số (Numeric)',
  text: 'Văn bản (Text)',
  boolean: 'Đúng/Sai (Boolean)',
}

function getSpecialtyName(assay: AssayDefinition | undefined, specialties: LabSpecialty[]) {
  const specialty = specialties.find((item) => item.id === assay?.specialty_id)
  return specialty?.name || '-'
}

function getValidationRules(assay: AssayDefinition | undefined) {
  return (assay?.validation_rules || {}) as RawValidationRules
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{value}</div>
    </div>
  )
}

function ReadOnlyValidationRules({ assay }: { assay?: AssayDefinition }) {
  const rules = getValidationRules(assay)
  const dataType = rules.type || rules.dataType || 'numeric'

  return (
    <div className="rounded-lg border p-4">
      <h4 className="font-medium mb-4">Quy tắc validation</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReadOnlyRow label="Kiểu dữ liệu" value={DATA_TYPE_LABELS[dataType] || dataType} />
        <ReadOnlyRow label="Bắt buộc nhập kết quả" value={rules.required ? 'Có' : 'Không'} />
        <ReadOnlyRow
          label="Giá trị tối thiểu"
          value={rules.min === undefined ? '-' : String(rules.min)}
        />
        <ReadOnlyRow
          label="Giá trị tối đa"
          value={rules.max === undefined ? '-' : String(rules.max)}
        />
      </div>
    </div>
  )
}

function ReadOnlyAssayFields({
  assay,
  specialties,
}: {
  assay?: AssayDefinition
  specialties: LabSpecialty[]
}) {
  return (
    <div className="space-y-4 py-4">
      <ReadOnlyRow label="Tên chỉ tiêu" value={assay?.name || '-'} />
      <ReadOnlyRow label="Nhóm kỹ thuật" value={getSpecialtyName(assay, specialties)} />
      <ReadOnlyRow label="Phương pháp" value={getAssayDefinitionMethodName(assay) || '-'} />
      <ReadOnlyRow label="Đơn vị" value={assay?.units || '-'} />
      <ReadOnlyRow label="Chỉ tiêu bí mật" value={assay?.is_confidential ? 'Có' : 'Không'} />
      <ReadOnlyValidationRules assay={assay} />
    </div>
  )
}

export function AssayDefinitionFields({
  mode,
  form,
  assay,
  specialties,
  onSpecialtyCreated,
  methodNameSuggestions,
  loadingMethodNameSuggestions,
  disabled = false,
}: Props) {
  if (mode === 'view') {
    return <ReadOnlyAssayFields assay={assay} specialties={specialties} />
  }

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Tên chỉ tiêu <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          {...form.register('name')}
          placeholder="Ví dụ: pH, Độ đục, E.coli"
          disabled={disabled}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <SpecialtyField
        form={form}
        specialties={specialties}
        onSpecialtyCreated={onSpecialtyCreated}
        disabled={disabled}
      />

      <MethodNameField
        form={form}
        suggestions={methodNameSuggestions}
        loading={loadingMethodNameSuggestions}
        disabled={disabled}
      />

      <div className="space-y-2">
        <Label htmlFor="units">Đơn vị</Label>
        <Input
          id="units"
          {...form.register('units')}
          placeholder="Ví dụ: mg/L, CFU/100mL"
          disabled={disabled}
        />
      </div>

      <div className="flex items-start gap-3 rounded-md border p-3">
        <Checkbox
          id="isConfidential"
          checked={form.watch('isConfidential')}
          onCheckedChange={(checked) => form.setValue('isConfidential', checked === true)}
          disabled={disabled}
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

      <ValidationRulesFields form={form} disabled={disabled} />
    </div>
  )
}
