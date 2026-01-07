# QC Material CRUD UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Create, Edit, and Delete UI functionality to the QC Materials tab on `/manager/quality-control` page.

**Architecture:** Create a reusable `QCMaterialDialog` component for Create/Edit modes, a `DeleteQCMaterialDialog` for delete confirmation, and update `QCMaterialsTable` with action buttons. Uses existing server actions from `qc-setup.ts`.

**Tech Stack:** React 19, react-hook-form, Zod, Shadcn UI (Dialog, Form, Button, Input, Select), sonner for toasts, lucide-react icons.

---

## Pre-Implementation Checklist

- [ ] Backend server actions exist: `createQCMaterial`, `updateQCMaterial`, `deleteQCMaterial` in `src/app/actions/qc-setup.ts`
- [ ] Zod schemas exist: `CreateQCMaterialSchema`, `UpdateQCMaterialSchema` in `src/types/qc/materials.ts`
- [ ] Database table `qc_materials` is seeded with realistic data (migration 113)

---

## Task 1: Create QCMaterialForm Component

**Files:**
- Create: `src/components/qc/qc-material-form.tsx`

**Step 1: Create the form component with Zod validation**

```tsx
'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createQCMaterial, updateQCMaterial } from '@/app/actions/qc-setup'
import type { QCMaterial } from './qc-materials-table'

// Form schema matching backend validation
const QCMaterialFormSchema = z.object({
    name: z.string().min(1, 'Tên vật liệu là bắt buộc').max(200),
    manufacturer: z.string().min(1, 'Nhà sản xuất là bắt buộc').max(200),
    lot_number: z.string().min(1, 'Số lô là bắt buộc').max(100),
    expiry_date: z.string().min(1, 'Ngày hết hạn là bắt buộc'),
    level: z.enum(['low', 'normal', 'high'], {
        required_error: 'Mức độ là bắt buộc',
    }),
    notes: z.string().max(500).optional(),
})

type QCMaterialFormData = z.infer<typeof QCMaterialFormSchema>

interface QCMaterialFormProps {
    material?: QCMaterial
    onSuccess: () => void
    onCancel: () => void
}

export function QCMaterialForm({ material, onSuccess, onCancel }: QCMaterialFormProps) {
    const [isPending, startTransition] = useTransition()
    const isEditMode = !!material

    const form = useForm<QCMaterialFormData>({
        resolver: zodResolver(QCMaterialFormSchema),
        defaultValues: {
            name: material?.name ?? '',
            manufacturer: material?.manufacturer ?? '',
            lot_number: material?.lot_number ?? '',
            expiry_date: material?.expiry_date?.split('T')[0] ?? '',
            level: (material?.level as 'low' | 'normal' | 'high') ?? 'normal',
            notes: '',
        },
    })

    const onSubmit = (data: QCMaterialFormData) => {
        startTransition(async () => {
            try {
                const result = isEditMode
                    ? await updateQCMaterial({ id: material.id, ...data })
                    : await createQCMaterial(data)

                if ('error' in result) {
                    toast.error(result.error)
                    return
                }

                toast.success(isEditMode ? 'Đã cập nhật vật liệu QC' : 'Đã thêm vật liệu QC mới')
                onSuccess()
            } catch (error) {
                toast.error('Đã xảy ra lỗi không mong muốn')
            }
        })
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Name */}
                <div className="space-y-2">
                    <Label htmlFor="name">Tên vật liệu *</Label>
                    <Input
                        id="name"
                        {...form.register('name')}
                        placeholder="VD: PreciControl ClinChem Multi 1"
                    />
                    {form.formState.errors.name && (
                        <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                    )}
                </div>

                {/* Manufacturer */}
                <div className="space-y-2">
                    <Label htmlFor="manufacturer">Nhà sản xuất *</Label>
                    <Input
                        id="manufacturer"
                        {...form.register('manufacturer')}
                        placeholder="VD: Roche Diagnostics"
                    />
                    {form.formState.errors.manufacturer && (
                        <p className="text-sm text-red-500">{form.formState.errors.manufacturer.message}</p>
                    )}
                </div>

                {/* Lot Number */}
                <div className="space-y-2">
                    <Label htmlFor="lot_number">Số lô *</Label>
                    <Input
                        id="lot_number"
                        {...form.register('lot_number')}
                        placeholder="VD: 604821"
                        disabled={isEditMode} // Lot number should not be changed
                    />
                    {form.formState.errors.lot_number && (
                        <p className="text-sm text-red-500">{form.formState.errors.lot_number.message}</p>
                    )}
                    {isEditMode && (
                        <p className="text-xs text-muted-foreground">Số lô không thể thay đổi sau khi tạo</p>
                    )}
                </div>

                {/* Level */}
                <div className="space-y-2">
                    <Label htmlFor="level">Mức độ *</Label>
                    <Select
                        value={form.watch('level')}
                        onValueChange={(value) => form.setValue('level', value as 'low' | 'normal' | 'high')}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn mức độ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Thấp (Low)</SelectItem>
                            <SelectItem value="normal">Bình thường (Normal)</SelectItem>
                            <SelectItem value="high">Cao (High)</SelectItem>
                        </SelectContent>
                    </Select>
                    {form.formState.errors.level && (
                        <p className="text-sm text-red-500">{form.formState.errors.level.message}</p>
                    )}
                </div>

                {/* Expiry Date */}
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="expiry_date">Ngày hết hạn *</Label>
                    <Input
                        id="expiry_date"
                        type="date"
                        {...form.register('expiry_date')}
                    />
                    {form.formState.errors.expiry_date && (
                        <p className="text-sm text-red-500">{form.formState.errors.expiry_date.message}</p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
                    Hủy
                </Button>
                <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditMode ? 'Cập nhật' : 'Thêm mới'}
                </Button>
            </div>
        </form>
    )
}
```

**Step 2: Verify file was created correctly**

Run: `ls -la src/components/qc/qc-material-form.tsx`
Expected: File exists with correct content

**Step 3: Commit**

```bash
git add src/components/qc/qc-material-form.tsx
git commit -m "feat(qc): add QCMaterialForm component for create/edit"
```

---

## Task 2: Create QCMaterialDialog Component

**Files:**
- Create: `src/components/qc/qc-material-dialog.tsx`

**Step 1: Create the dialog wrapper component**

```tsx
'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { QCMaterialForm } from './qc-material-form'
import type { QCMaterial } from './qc-materials-table'

interface QCMaterialDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: 'create' | 'edit'
    material?: QCMaterial
}

export function QCMaterialDialog({
    open,
    onOpenChange,
    mode,
    material,
}: QCMaterialDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Thêm vật liệu QC mới' : 'Sửa vật liệu QC'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Thêm vật liệu kiểm soát chất lượng mới vào hệ thống.'
                            : 'Cập nhật thông tin vật liệu kiểm soát chất lượng.'}
                    </DialogDescription>
                </DialogHeader>
                <QCMaterialForm
                    material={material}
                    onSuccess={() => {
                        onOpenChange(false)
                        window.location.reload()
                    }}
                    onCancel={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    )
}
```

**Step 2: Commit**

```bash
git add src/components/qc/qc-material-dialog.tsx
git commit -m "feat(qc): add QCMaterialDialog wrapper component"
```

---

## Task 3: Create DeleteQCMaterialDialog Component

**Files:**
- Create: `src/components/qc/delete-qc-material-dialog.tsx`

**Step 1: Create the delete confirmation dialog**

```tsx
'use client'

import { useTransition } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteQCMaterial } from '@/app/actions/qc-setup'
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'
import type { QCMaterial } from './qc-materials-table'

interface DeleteQCMaterialDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    material: QCMaterial
}

export function DeleteQCMaterialDialog({
    open,
    onOpenChange,
    material,
}: DeleteQCMaterialDialogProps) {
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        startTransition(async () => {
            try {
                const result = await deleteQCMaterial(material.id)

                if ('error' in result) {
                    toast.error(result.error)
                    return
                }

                toast.success('Đã xóa vật liệu QC')
                onOpenChange(false)
                window.location.reload()
            } catch (error) {
                toast.error('Đã xảy ra lỗi không mong muốn')
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
                        </div>
                        <div>
                            <DialogTitle>Xác nhận xóa vật liệu QC</DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="pt-4">
                        Bạn có chắc chắn muốn xóa vật liệu{' '}
                        <strong>{material.name}</strong> (Lô: {material.lot_number})?
                        <br />
                        <br />
                        <span className="text-red-600 dark:text-red-500">
                            Lưu ý: Không thể xóa vật liệu đang được sử dụng trong giới hạn kiểm soát (QC Definitions).
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        Hủy
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isPending}
                    >
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Xóa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
```

**Step 2: Commit**

```bash
git add src/components/qc/delete-qc-material-dialog.tsx
git commit -m "feat(qc): add DeleteQCMaterialDialog with confirmation"
```

---

## Task 4: Update QCMaterialsTable with Action Buttons

**Files:**
- Modify: `src/components/qc/qc-materials-table.tsx`

**Step 1: Add state and action column to the table**

Update the file to include Edit/Delete buttons and dialog state management:

```tsx
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { QCMaterialDialog } from './qc-material-dialog'
import { DeleteQCMaterialDialog } from './delete-qc-material-dialog'

export interface QCMaterial {
    id: string
    name: string
    manufacturer: string | null
    lot_number: string
    level: string
    expiry_date: string | null
    created_at: string
}

interface QCMaterialsTableProps {
    materials: QCMaterial[]
}

export function QCMaterialsTable({ materials }: QCMaterialsTableProps) {
    const [editMaterial, setEditMaterial] = useState<QCMaterial | null>(null)
    const [deleteMaterial, setDeleteMaterial] = useState<QCMaterial | null>(null)

    if (materials.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Chưa có vật liệu QC nào. Nhấn &quot;Thêm vật liệu&quot; để bắt đầu.
            </div>
        )
    }

    const isExpired = (expiryDate: string | null) => {
        if (!expiryDate) return false
        return new Date(expiryDate) < new Date()
    }

    const isExpiringSoon = (expiryDate: string | null) => {
        if (!expiryDate) return false
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        const expiry = new Date(expiryDate)
        return expiry <= thirtyDaysFromNow && expiry >= new Date()
    }

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tên vật liệu</TableHead>
                        <TableHead>Nhà sản xuất</TableHead>
                        <TableHead>Số lô</TableHead>
                        <TableHead>Mức độ</TableHead>
                        <TableHead>Hạn sử dụng</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="w-[70px]">Thao tác</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {materials.map((material) => {
                        const expired = isExpired(material.expiry_date)
                        const expiringSoon = isExpiringSoon(material.expiry_date)

                        return (
                            <TableRow key={material.id}>
                                <TableCell className="font-medium">{material.name}</TableCell>
                                <TableCell>{material.manufacturer || '—'}</TableCell>
                                <TableCell className="font-mono text-sm">{material.lot_number}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {material.level === 'low' ? 'Thấp' :
                                         material.level === 'normal' ? 'Bình thường' :
                                         material.level === 'high' ? 'Cao' : material.level}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {material.expiry_date
                                        ? format(new Date(material.expiry_date), 'dd/MM/yyyy', { locale: vi })
                                        : '—'}
                                </TableCell>
                                <TableCell>
                                    {expired ? (
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Hết hạn
                                        </Badge>
                                    ) : expiringSoon ? (
                                        <Badge className="gap-1 bg-amber-100 text-amber-700">
                                            <AlertTriangle className="h-3 w-3" />
                                            Sắp hết hạn
                                        </Badge>
                                    ) : (
                                        <Badge className="gap-1 bg-green-100 text-green-700">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Còn hạn
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Mở menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => setEditMaterial(material)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Sửa
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => setDeleteMaterial(material)}
                                                className="text-red-600"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Xóa
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>

            {/* Edit Dialog */}
            {editMaterial && (
                <QCMaterialDialog
                    open={!!editMaterial}
                    onOpenChange={(open) => !open && setEditMaterial(null)}
                    mode="edit"
                    material={editMaterial}
                />
            )}

            {/* Delete Dialog */}
            {deleteMaterial && (
                <DeleteQCMaterialDialog
                    open={!!deleteMaterial}
                    onOpenChange={(open) => !open && setDeleteMaterial(null)}
                    material={deleteMaterial}
                />
            )}
        </>
    )
}
```

**Step 2: Commit**

```bash
git add src/components/qc/qc-materials-table.tsx
git commit -m "feat(qc): add edit/delete actions to QCMaterialsTable"
```

---

## Task 5: Add "Thêm vật liệu" Button to Materials Tab

**Files:**
- Modify: `src/components/qc/quality-control-page-client.tsx`

**Step 1: Add state and button for creating new material**

Add import and state at the top:

```tsx
import { QCMaterialDialog } from './qc-material-dialog'

// Inside component, add state:
const [showAddMaterial, setShowAddMaterial] = useState(false)
```

**Step 2: Update the Materials tab CardHeader**

Find the materials TabsContent section and update it:

```tsx
<TabsContent value="materials">
    <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Vật liệu QC</CardTitle>
                    <CardDescription>
                        Quản lý vật liệu kiểm soát chất lượng
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setShowAddMaterial(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm vật liệu
                    </Button>
                    {firstMaterial && (
                        <LotChangeoverDialog
                            currentMaterial={firstMaterial}
                            definitions={definitionsForChangeover}
                            trigger={
                                <Button variant="outline" size="sm">
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Chuyển lô
                                </Button>
                            }
                        />
                    )}
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <QCMaterialsTable materials={materials} />
        </CardContent>
    </Card>
</TabsContent>
```

**Step 3: Add the dialog at the end of the component (before closing div)**

```tsx
{/* Add Material Dialog */}
<QCMaterialDialog
    open={showAddMaterial}
    onOpenChange={setShowAddMaterial}
    mode="create"
/>
```

**Step 4: Commit**

```bash
git add src/components/qc/quality-control-page-client.tsx
git commit -m "feat(qc): add 'Thêm vật liệu' button to Materials tab"
```

---

## Task 6: Update Server Page to Pass expiry_date Field

**Files:**
- Modify: `src/app/(dashboard)/manager/quality-control/page.tsx`

**Step 1: Verify the query includes expiration_date**

Check line 46-50 and ensure `expiration_date` is selected (note: DB uses `expiration_date`, UI expects `expiry_date`):

The current query:
```typescript
const { data: materials } = await supabase
    .from('qc_materials')
    .select('id, name, manufacturer, lot_number, level, expiry_date, created_at')
```

Should be:
```typescript
const { data: materials } = await supabase
    .from('qc_materials')
    .select('id, name, manufacturer, lot_number, level, expiration_date, created_at')
```

**Step 2: Transform the data before passing to client**

Add transformation after fetching:
```typescript
const transformedMaterials = (materials || []).map(m => ({
    ...m,
    expiry_date: m.expiration_date, // Map DB field to expected UI field
}))
```

**Step 3: Pass transformed data to client component**

```typescript
<QualityControlPageClient
    ...
    materials={transformedMaterials}
    ...
/>
```

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/manager/quality-control/page.tsx
git commit -m "fix(qc): map expiration_date to expiry_date for materials"
```

---

## Task 7: Manual Testing Checklist

**Test Create:**
1. Navigate to `/manager/quality-control`
2. Click "Vật liệu" tab
3. Click "Thêm vật liệu" button
4. Fill form with valid data
5. Submit and verify toast success message
6. Verify new material appears in table

**Test Edit:**
1. Click action menu (⋯) on any row
2. Click "Sửa"
3. Modify name or expiry date
4. Submit and verify toast success message
5. Verify changes appear in table

**Test Delete:**
1. Click action menu (⋯) on any row
2. Click "Xóa"
3. Confirm deletion
4. Verify toast success message
5. Verify material removed from table

**Test Validation:**
1. Try submitting empty form → should show validation errors
2. Try duplicate lot number → should show backend error

---

## Task 8: Final Commit

```bash
git add -A
git commit -m "feat(qc): complete QC Material CRUD UI implementation

- Add QCMaterialForm for create/edit with Zod validation
- Add QCMaterialDialog wrapper component
- Add DeleteQCMaterialDialog with confirmation
- Update QCMaterialsTable with action dropdown
- Add 'Thêm vật liệu' button to Materials tab header
- Fix expiration_date field mapping

Closes: QC Material management UI gap"
```

---

## Summary

| Task | Component | Purpose |
|------|-----------|---------|
| 1 | `qc-material-form.tsx` | Reusable form with Zod validation |
| 2 | `qc-material-dialog.tsx` | Dialog wrapper for create/edit |
| 3 | `delete-qc-material-dialog.tsx` | Delete confirmation dialog |
| 4 | `qc-materials-table.tsx` | Add action column with edit/delete |
| 5 | `quality-control-page-client.tsx` | Add "Thêm vật liệu" button |
| 6 | `page.tsx` | Fix expiration_date field mapping |
| 7 | Manual testing | Verify all CRUD operations |
| 8 | Final commit | Commit all changes |
