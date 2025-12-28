'use client'

import { useState, useTransition } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, X, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { LabSpecialty, CreateLabSpecialtySchema } from '@/types'
import { createLabSpecialty } from '@/app/actions/lab-specialties'
import { AssayFormValues } from './types'

type Props = {
  form: UseFormReturn<AssayFormValues>
  specialties: LabSpecialty[]
  onSpecialtyCreated: (specialty: LabSpecialty) => void
  disabled?: boolean
}

export function SpecialtyField({
  form,
  specialties,
  onSpecialtyCreated,
  disabled = false,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [isCreating, setIsCreating] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const specialtyId = form.watch('specialtyId')

  const handleCreate = (e: React.MouseEvent) => {
    e.preventDefault()

    const validation = CreateLabSpecialtySchema.safeParse({
      name: newName,
      code: newCode,
      description: newDescription || undefined,
    })

    if (!validation.success) {
      const errorMessages = Object.values(validation.error.flatten().fieldErrors)
        .flat()
        .join(', ')
      toast.error(errorMessages || 'Dữ liệu không hợp lệ')
      return
    }

    const formData = new FormData()
    formData.append('name', newName)
    formData.append('code', newCode)
    if (newDescription) formData.append('description', newDescription)

    startTransition(async () => {
      const result = await createLabSpecialty(formData)

      if (result.error) {
        toast.error(result.error)
      } else if (result.success && result.data) {
        toast.success('Đã tạo nhóm kỹ thuật thành công')
        onSpecialtyCreated(result.data)
        form.setValue('specialtyId', result.data.id)
        resetInlineForm()
      }
    })
  }

  const resetInlineForm = () => {
    setIsCreating(false)
    setNewCode('')
    setNewName('')
    setNewDescription('')
  }

  const toggleMode = () => {
    if (isCreating) {
      resetInlineForm()
    } else {
      setIsCreating(true)
    }
  }

  if (isCreating) {
    return (
      <div className="space-y-2">
        <Label>Nhóm kỹ thuật <span className="text-red-500">*</span></Label>
        <div className="space-y-3 p-3 border rounded-md bg-muted/20">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium">Tạo nhóm kỹ thuật mới</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleMode}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="newSpecCode" className="text-xs">Mã (viết tắt)</Label>
              <Input
                id="newSpecCode"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="VD: MIC"
                className="h-8 text-sm"
                maxLength={20}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newSpecName" className="text-xs">Tên nhóm</Label>
              <Input
                id="newSpecName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VD: Vi sinh vật"
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="newSpecDesc" className="text-xs">Mô tả</Label>
              <Textarea
                id="newSpecDesc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Mô tả thêm..."
                className="h-16 text-sm resize-none"
              />
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full mt-2"
            onClick={handleCreate}
            disabled={isPending || !newCode || !newName}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
            Lưu nhóm kỹ thuật
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="specialty">Nhóm kỹ thuật <span className="text-red-500">*</span></Label>
      <div className="flex gap-2">
        <Select
          value={specialtyId}
          onValueChange={(value) => form.setValue('specialtyId', value)}
          disabled={disabled || isPending}
        >
          <SelectTrigger id="specialty" className="w-full">
            <SelectValue placeholder="Chọn Nhóm kỹ thuật" />
          </SelectTrigger>
          <SelectContent>
            {specialties.map((specialty) => (
              <SelectItem key={specialty.id} value={specialty.id}>
                {specialty.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                onClick={toggleMode}
                disabled={disabled || isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Thêm nhóm kỹ thuật mới</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {form.formState.errors.specialtyId && (
        <p className="text-sm text-destructive">
          {form.formState.errors.specialtyId.message}
        </p>
      )}
    </div>
  )
}
