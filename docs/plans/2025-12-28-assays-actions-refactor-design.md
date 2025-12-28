# Assays Actions Refactor Design

**Date:** 2025-12-28
**Goal:** Reduce `src/app/actions/assays.ts` from 591 lines to <350 lines
**Approach:** Split by responsibility + move complex query logic to database RPCs

## Current State

| Function | Lines | Complexity |
|:---------|------:|:-----------|
| `getAssayDefinitions` | ~220 | High - search, filter, sort, pagination, data merging |
| `getAssayDefinitionById` | ~77 | Medium - fetches + merges methods |
| `createAssayDefinition` | ~80 | Medium - role check + insert + method link |
| `updateAssayDefinition` | ~66 | Medium - role check + update |
| `deleteAssayDefinition` | ~54 | Low - role check + soft delete |
| `getSpecialties` | ~22 | Low - simple query |
| `getMethods` | ~21 | Low - simple query |
| **Total** | **591** | |

## Target Structure

```
src/app/actions/
├── assays.ts              # DELETE
├── assay-queries.ts       # ~80 lines
├── assay-mutations.ts     # ~120 lines
├── assay-lookups.ts       # ~50 lines

supabase/migrations/
├── XXX_assay_rpc_functions.sql
```

## Design Decisions

1. **Flat file structure** - prefixed files at same level (not nested folder)
2. **Use existing auth-helpers** - `requireRole('manager')` from `@/lib/auth-helpers`
3. **Database RPCs** - move complex search/filter/sort/join logic to PostgreSQL
4. **Separate RPCs** - `get_assay_definitions()` for list, `get_assay_definition_by_id()` for single

## Database RPC Functions

### `get_assay_definitions()`

```sql
CREATE OR REPLACE FUNCTION get_assay_definitions(
  p_search text DEFAULT NULL,
  p_method_id uuid DEFAULT NULL,
  p_specialty_id uuid DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  specialty_id uuid,
  specialty_name text,
  specialty_order int,
  units text,
  validation_rules jsonb,
  methods jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
```

**Logic:**
1. CTE for base assays filtered by `deleted_at IS NULL`
2. LEFT JOIN `lab_specialties` for specialty info
3. LEFT JOIN `assay_methods` + `methods` for method aggregation via `jsonb_agg()`
4. Search filter: `name ILIKE` OR `specialty.name ILIKE` OR `method.name ILIKE`
5. Specialty filter if provided
6. Method filter if provided (via EXISTS subquery)
7. Sort: `specialty.display_order, specialty.name, assay.name`
8. `COUNT(*) OVER()` for total count
9. `LIMIT/OFFSET` for pagination

### `get_assay_definition_by_id()`

```sql
CREATE OR REPLACE FUNCTION get_assay_definition_by_id(p_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  specialty_id uuid,
  units text,
  validation_rules jsonb,
  methods jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
```

Fetches single assay with aggregated methods JSONB array.

## TypeScript Files

### `assay-queries.ts` (~80 lines)

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'

export async function getAssayDefinitions(params?: {
  page?: number
  pageSize?: number
  search?: string
  methodId?: string
  specialtyId?: string
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_assay_definitions', {
    p_search: params?.search || null,
    p_method_id: params?.methodId || null,
    p_specialty_id: params?.specialtyId || null,
    p_page: params?.page || 1,
    p_page_size: params?.pageSize || 10,
  })

  if (error) return { error: error.message }
  if (!data?.length) {
    return { data: [], totalCount: 0, totalPages: 0, page: params?.page || 1, pageSize: params?.pageSize || 10 }
  }

  const totalCount = data[0].total_count
  return {
    data: data.map(row => ({ ...row, total_count: undefined })),
    totalCount,
    totalPages: Math.ceil(totalCount / (params?.pageSize || 10)),
    page: params?.page || 1,
    pageSize: params?.pageSize || 10,
  }
}

export async function getAssayDefinitionById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_assay_definition_by_id', { p_id: id })

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Không tìm thấy chỉ tiêu' }
  return { data: data[0] }
}
```

### `assay-mutations.ts` (~120 lines)

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CreateAssayDefinitionSchema } from '@/types'
import { requireRole, isAuthError } from '@/lib/auth-helpers'

const UpdateAssayDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  specialty_id: z.string().uuid().optional(),
  units: z.string().optional(),
  validation_rules: z.record(z.string(), z.any()).optional(),
})

export async function createAssayDefinition(formData: FormData) {
  const auth = await requireRole('manager')
  if (isAuthError(auth)) return { error: 'Chỉ Quản lý mới có thể tạo chỉ tiêu xét nghiệm' }

  const supabase = await createClient()
  // Parse, validate, insert assay_definitions, optionally insert assay_methods
  revalidatePath('/manager/assays')
  return { success: true, data }
}

export async function updateAssayDefinition(formData: FormData) {
  const auth = await requireRole('manager')
  if (isAuthError(auth)) return { error: 'Chỉ Quản lý mới có thể cập nhật chỉ tiêu xét nghiệm' }

  const supabase = await createClient()
  // Parse, validate, update
  revalidatePath('/manager/assays')
  return { success: true, data }
}

export async function deleteAssayDefinition(id: string) {
  const auth = await requireRole('manager')
  if (isAuthError(auth)) return { error: 'Chỉ Quản lý mới có thể xóa chỉ tiêu xét nghiệm' }

  const supabase = await createClient()
  // Soft delete (set deleted_at)
  revalidatePath('/manager/assays')
  return { success: true }
}
```

### `assay-lookups.ts` (~50 lines)

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'

export async function getSpecialties() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lab_specialties')
      .select('id, name, code, display_order')
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) return { error: error.message }
    return { data }
  } catch {
    return { error: 'Đã xảy ra lỗi không mong muốn' }
  }
}

export async function getMethods() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('methods')
      .select('id, name, description')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) return { error: error.message }
    return { data }
  } catch {
    return { error: 'Đã xảy ra lỗi không mong muốn' }
  }
}
```

## Import Updates Required

Files importing from `@/app/actions/assays` need updating:

```typescript
// Before
import { getAssayDefinitions, createAssayDefinition, getSpecialties } from '@/app/actions/assays'

// After
import { getAssayDefinitions, getAssayDefinitionById } from '@/app/actions/assay-queries'
import { createAssayDefinition, updateAssayDefinition, deleteAssayDefinition } from '@/app/actions/assay-mutations'
import { getSpecialties, getMethods } from '@/app/actions/assay-lookups'
```

## Expected Results

| File | Lines |
|:-----|------:|
| `assay-queries.ts` | ~80 |
| `assay-mutations.ts` | ~120 |
| `assay-lookups.ts` | ~50 |
| **Total TypeScript** | **~250** |
| `XXX_assay_rpc_functions.sql` | ~100 |

**Reduction:** 591 → 250 lines (58% reduction)

## Implementation Tasks

1. Create migration with RPC functions (`get_assay_definitions`, `get_assay_definition_by_id`)
2. Apply migration and test RPCs directly in psql
3. Create `assay-queries.ts` using RPCs
4. Create `assay-mutations.ts` using `requireRole()`
5. Create `assay-lookups.ts` (extract from original)
6. Find and update all imports from old `assays.ts`
7. Delete original `assays.ts`
8. Run typecheck and fix any issues
9. Test UI functionality (list, create, update, delete)
