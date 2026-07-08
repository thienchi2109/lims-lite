'use client'

import { UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AssayFormValues } from './types'

type Props = {
  form: UseFormReturn<AssayFormValues>
  disabled?: boolean
}

export function ValidationRulesFields({ form, disabled = false }: Props) {
  const dataType = form.watch('validationRules.type') || 'numeric'
  const isBoolean = dataType === 'boolean'
  const parseOptionalNumber = (value: string) =>
    value === '' ? undefined : Number(value)

  const handleTypeChange = (value: string) => {
    form.setValue('validationRules.type', value as 'numeric' | 'text' | 'boolean')
    if (value === 'boolean') {
      form.setValue('validationRules.min', undefined)
      form.setValue('validationRules.max', undefined)
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-3">Quy tắc xác thực (không bắt buộc)</h4>

        {/* Min and Max in a grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="min_value">Giá trị tối thiểu</Label>
            <Input
              id="min_value"
              type="number"
              step="any"
              {...form.register('validationRules.min', { setValueAs: parseOptionalNumber })}
              placeholder="0"
              disabled={disabled || isBoolean}
            />
            {form.formState.errors.validationRules?.min && (
              <p className="text-sm text-destructive">
                {form.formState.errors.validationRules.min.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_value">Giá trị tối đa</Label>
            <Input
              id="max_value"
              type="number"
              step="any"
              {...form.register('validationRules.max', { setValueAs: parseOptionalNumber })}
              placeholder="100"
              disabled={disabled || isBoolean}
            />
          </div>
        </div>

        {/* Data Type */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="data_type">Kiểu dữ liệu</Label>
          <Select
            value={dataType}
            onValueChange={handleTypeChange}
            disabled={disabled}
          >
            <SelectTrigger id="data_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="numeric">Số (Numeric)</SelectItem>
              <SelectItem value="text">Văn bản (Text)</SelectItem>
              <SelectItem value="boolean">Dương tính/Âm tính</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Required Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_required"
            checked={form.watch('validationRules.required') || false}
            onCheckedChange={(checked) =>
              form.setValue('validationRules.required', checked === true)
            }
            disabled={disabled}
          />
          <Label
            htmlFor="is_required"
            className="text-sm font-normal cursor-pointer"
          >
            Bắt buộc nhập kết quả
          </Label>
        </div>
      </div>
    </div>
  )
}
