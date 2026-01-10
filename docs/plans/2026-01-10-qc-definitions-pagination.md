# QC Definitions Table Pagination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-side pagination to the QC Definitions ("Giới hạn") tab matching the pattern used by Sessions and Materials tabs.

**Architecture:** Server-side pagination using URL search params (`def_page`, `def_size`) with data fetched via a new `getQCDefinitionsPaginated` server action. The `DataTablePagination` component handles UI and URL state.

**Tech Stack:** Next.js 16 Server Components, Supabase, TypeScript, shadcn/ui DataTablePagination

---

## Task 1: Add Types for Definitions Pagination

**Files:**
- Modify: `src/types/qc/definitions.ts`

**Step 1: Add filter and result types**

Add to end of `src/types/qc/definitions.ts`:

```typescript
// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface QCDefinitionsFilters {
    page?: number           // Default: 1
    page_size?: number      // Default: 20
    search?: string         // Search by assay name or material name
    status?: 'active' | 'inactive' | null  // Filter by is_active
}

export interface QCDefinitionsResult {
    data: QCDefinitionWithDetails[]
    total: number
    page: number
    page_size: number
    total_pages: number
}
```

**Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: No errors related to QC definitions types

**Step 3: Commit**

```bash
git add src/types/qc/definitions.ts
git commit -m "feat(qc): add pagination types for QC definitions"
```

---

## Task 2: Create getQCDefinitionsPaginated Server Action

**Files:**
- Modify: `src/app/actions/qc-definitions.ts`
- Modify: `src/app/actions/qc-setup.ts` (add export)

**Step 1: Add paginated function to qc-definitions.ts**

Add after `getQCDefinitions` function in `src/app/actions/qc-definitions.ts`:

```typescript
import type { QCDefinitionsFilters, QCDefinitionsResult, QCDefinitionWithDetails } from '@/types/qc'

/**
 * Gets QC definitions with pagination and optional filtering
 * Returns definitions with assay and material details
 */
export async function getQCDefinitionsPaginated(
    filters: QCDefinitionsFilters = {}
): Promise<QCDefinitionsResult | { error: string }> {
    try {
        const supabase = await createClient()

        const page = filters.page ?? 1
        const pageSize = filters.page_size ?? 20
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        // Build base query with count
        let query = supabase
            .from('qc_definitions')
            .select(`
                id,
                mean,
                sd,
                cv_percent,
                is_active,
                active_from:active_date,
                data_points_count,
                assay_id,
                material_id,
                assay:assay_definitions!inner(id, name, units),
                material:qc_materials!inner(id, name, lot_number, level)
            `, { count: 'exact' })
            .is('deleted_at', null)

        // Apply status filter
        if (filters.status === 'active') {
            query = query.eq('is_active', true)
        } else if (filters.status === 'inactive') {
            query = query.eq('is_active', false)
        }

        // Apply search filter (on assay name or material name)
        // Note: Supabase doesn't support ilike on joined tables directly,
        // so we'll filter client-side for search or use a different approach
        // For now, we skip server-side search as it requires RPC or view

        // Order and paginate
        query = query.order('created_at', { ascending: false }).range(from, to)

        const { data, error, count } = await query

        if (error) {
            console.error('Error fetching paginated QC definitions:', error)
            return { error: error.message }
        }

        // Transform data to match QCDefinitionWithDetails
        const transformedData: QCDefinitionWithDetails[] = (data || []).map((def) => {
            const rawAssay = def.assay as any
            const rawMaterial = def.material as any
            const assay = Array.isArray(rawAssay) ? rawAssay[0] : rawAssay
            const material = Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial

            // Calculate CV% from mean and SD if not stored
            const cvPercent = def.cv_percent ?? (def.mean > 0 ? (def.sd / def.mean) * 100 : null)

            return {
                id: def.id,
                mean: def.mean,
                sd: def.sd,
                cv_percent: cvPercent,
                is_active: def.is_active,
                active_from: def.active_from,
                data_points_count: def.data_points_count,
                assay_id: assay?.id || '',
                assay_name: assay?.name || '',
                assay_units: assay?.units || null,
                material_id: material?.id || '',
                material_name: material?.name || '',
                material_lot: material?.lot_number || '',
                material_level: material?.level || '',
            }
        })

        const total = count ?? 0

        return {
            data: transformedData,
            total,
            page,
            page_size: pageSize,
            total_pages: Math.ceil(total / pageSize),
        }
    } catch (error) {
        console.error('Error in getQCDefinitionsPaginated:', error)
        return { error: error instanceof Error ? error.message : 'Không thể tải giới hạn kiểm soát' }
    }
}
```

**Step 2: Export from barrel file**

Add to `src/app/actions/qc-setup.ts` exports:

```typescript
// QC Definitions
export {
    createQCDefinition,
    updateQCDefinition,
    getQCDefinitions,
    getQCDefinitionsPaginated,  // Add this
} from './qc-definitions'
```

**Step 3: Verify types compile**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/actions/qc-definitions.ts src/app/actions/qc-setup.ts
git commit -m "feat(qc): add getQCDefinitionsPaginated server action"
```

---

## Task 3: Update QCDefinitionsTable Component

**Files:**
- Modify: `src/components/qc/qc-definitions-table.tsx`

**Step 1: Update component with pagination props and UI**

Replace entire file content:

```typescript
'use client'

import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { CheckCircle2, Settings, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export interface QCDefinitionWithDetails {
    id: string
    mean: number
    sd: number
    cv_percent: number | null
    is_active: boolean
    active_from: string
    data_points_count: number | null
    assay_id: string
    assay_name: string
    assay_units: string | null
    material_id: string
    material_name: string
    material_lot: string
    material_level: string
}

interface QCDefinitionsTableProps {
    definitions: QCDefinitionWithDetails[]
    total: number
    page: number
    pageSize: number
}

export function QCDefinitionsTable({
    definitions,
    total,
    page,
    pageSize,
}: QCDefinitionsTableProps) {
    if (definitions.length === 0 && total === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-8 w-8 mx-auto mb-2" />
                Chưa có giới hạn kiểm soát nào. Nhấn &quot;Thiết lập mới&quot; để bắt đầu.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Xét nghiệm</TableHead>
                            <TableHead>Vật liệu / Mức độ</TableHead>
                            <TableHead className="text-right">Mean</TableHead>
                            <TableHead className="text-right">SD</TableHead>
                            <TableHead className="text-right">CV%</TableHead>
                            <TableHead>Ngày hiệu lực</TableHead>
                            <TableHead>Trạng thái</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {definitions.map((def) => (
                            <TableRow key={def.id}>
                                <TableCell>
                                    <div className="font-medium">{def.assay_name}</div>
                                    {def.assay_units && (
                                        <div className="text-xs text-muted-foreground">{def.assay_units}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div>{def.material_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {def.material_level === 'Low' ? 'Thấp' :
                                         def.material_level === 'Normal' ? 'Bình thường' :
                                         def.material_level === 'High' ? 'Cao' : def.material_level}
                                        {' • Lô: '}{def.material_lot}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {def.mean.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {def.sd.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {def.cv_percent ? `${def.cv_percent.toFixed(1)}%` : '—'}
                                </TableCell>
                                <TableCell>
                                    {format(new Date(def.active_from), 'dd/MM/yyyy', { locale: vi })}
                                </TableCell>
                                <TableCell>
                                    {def.is_active ? (
                                        <Badge className="gap-1 bg-green-100 text-green-700">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Đang sử dụng
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="gap-1">
                                            <XCircle className="h-3 w-3" />
                                            Ngừng sử dụng
                                        </Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <DataTablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                paramPrefix="def_"
            />
        </div>
    )
}
```

**Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: Errors about missing props in parent component (expected, will fix in next task)

**Step 3: Commit**

```bash
git add src/components/qc/qc-definitions-table.tsx
git commit -m "feat(qc): update QCDefinitionsTable with pagination support"
```

---

## Task 4: Update QualityControlPageClient Props

**Files:**
- Modify: `src/components/qc/quality-control-page-client.tsx`

**Step 1: Add definitions pagination props to interface**

Find `QualityControlPageClientProps` interface and add after `qcDays`:

```typescript
    // Definitions pagination props
    definitionsTotal: number
    definitionsPage: number
    definitionsPageSize: number
```

**Step 2: Destructure new props in component**

Add to destructured props:

```typescript
    definitionsTotal,
    definitionsPage,
    definitionsPageSize,
```

**Step 3: Update QCDefinitionsTable usage**

Find:
```tsx
<QCDefinitionsTable definitions={definitions} />
```

Replace with:
```tsx
<QCDefinitionsTable
    definitions={definitions}
    total={definitionsTotal}
    page={definitionsPage}
    pageSize={definitionsPageSize}
/>
```

**Step 4: Verify types compile**

Run: `npm run typecheck`
Expected: Errors about missing props from page.tsx (expected, will fix in next task)

**Step 5: Commit**

```bash
git add src/components/qc/quality-control-page-client.tsx
git commit -m "feat(qc): add definitions pagination props to client component"
```

---

## Task 5: Update page.tsx to Use Paginated Action

**Files:**
- Modify: `src/app/(dashboard)/manager/quality-control/page.tsx`

**Step 1: Add def_ params to PageSearchParams interface**

Add to `PageSearchParams`:

```typescript
    // Definitions tab pagination
    def_page?: string
    def_size?: string
    def_status?: string
```

**Step 2: Add import for getQCDefinitionsPaginated**

Update import:
```typescript
import { getQCMaterials, getQCDefinitionsPaginated, type GetQCMaterialsParams } from '@/app/actions/qc-setup'
```

**Step 3: Parse definitions params (after line 55)**

Add after sessions param parsing:

```typescript
    // Parse definitions pagination params with defaults
    const defPage = params.def_page ? parseInt(params.def_page, 10) : 1
    const defPageSize = params.def_size ? parseInt(params.def_size, 10) : 20
    const defStatus = params.def_status as 'active' | 'inactive' | undefined
```

**Step 4: Replace inline definitions query with server action**

Find the block (lines 120-133):
```typescript
    // Fetch QC Definitions with assay and material details
    const { data: definitions } = await supabase
        .from('qc_definitions')
        .select(`...`)
        .order('created_at', { ascending: false })
```

Replace with:
```typescript
    // Fetch QC Definitions with pagination
    const definitionsResult = await getQCDefinitionsPaginated({
        page: defPage,
        page_size: defPageSize,
        status: defStatus || undefined,
    })

    // Handle definitions result
    const definitions = 'error' in definitionsResult ? [] : definitionsResult.data
    const definitionsTotal = 'error' in definitionsResult ? 0 : definitionsResult.total
```

**Step 5: Update transformedDefinitions to use the already-transformed data**

Since `getQCDefinitionsPaginated` already returns `QCDefinitionWithDetails[]`, simplify:

Find:
```typescript
    // Transform data for client component
    const transformedDefinitions = (definitions || []).map((def) => {
        // ... complex transformation
    })
```

Replace with:
```typescript
    // Definitions already transformed by server action
    const transformedDefinitions = definitions
```

**Step 6: Update stats.totalDefinitions**

Find:
```typescript
        totalDefinitions: transformedDefinitions.length,
```

Replace with:
```typescript
        totalDefinitions: definitionsTotal,
```

**Step 7: Add new props to QualityControlPageClient**

Add after sessions props (before closing `/>` of QualityControlPageClient):

```typescript
                    // Definitions pagination props
                    definitionsTotal={definitionsTotal}
                    definitionsPage={defPage}
                    definitionsPageSize={defPageSize}
```

**Step 8: Verify types compile**

Run: `npm run typecheck`
Expected: No errors

**Step 9: Commit**

```bash
git add src/app/(dashboard)/manager/quality-control/page.tsx
git commit -m "feat(qc): integrate definitions pagination in page.tsx"
```

---

## Task 6: Manual Testing

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to QC page**

Open: `http://localhost:3000/manager/quality-control`

**Step 3: Test "Giới hạn" tab**

1. Click on "Giới hạn" tab
2. Verify table displays with pagination footer
3. Verify "Hiển thị X - Y của Z kết quả" shows correctly
4. Click page 2 (if enough data) - verify URL updates to `?def_page=2`
5. Change page size - verify URL updates to `?def_size=10`
6. Refresh page - verify pagination state persists from URL

**Step 4: Test empty state**

If no definitions exist, verify empty state message appears

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(qc): complete QC definitions pagination implementation"
```

---

## Summary

| Task | Description | Files Modified |
|------|-------------|----------------|
| 1 | Add pagination types | `src/types/qc/definitions.ts` |
| 2 | Create server action | `src/app/actions/qc-definitions.ts`, `qc-setup.ts` |
| 3 | Update table component | `src/components/qc/qc-definitions-table.tsx` |
| 4 | Update client props | `src/components/qc/quality-control-page-client.tsx` |
| 5 | Update page.tsx | `src/app/(dashboard)/manager/quality-control/page.tsx` |
| 6 | Manual testing | N/A |

**Estimated Complexity:** Low-medium (follows established pattern)
