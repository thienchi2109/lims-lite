# Assay Definition Dialog Refactor Design

**Date:** 2025-01-28
**Status:** Approved
**Goal:** Reduce `assay-definition-dialog.tsx` from 602 lines to <350 lines while improving maintainability, reusability, and testability.

## Problem Statement

The current `assay-definition-dialog.tsx` suffers from:
- **602 lines** - nearly double the 350-line target
- **15+ individual useState hooks** - difficult to manage and test
- **Type safety gaps** - `Record<string, any>` and `as any` casts
- **God component tendency** - inline specialty creation adds bulk
- **No validation schema** - manual checks in submit handler

Issues identified by Gemini CLI analysis:
1. State management complexity → refactor to react-hook-form
2. Type safety gaps → proper Zod schemas
3. Prop drilling for specialties → local state management
4. Method deduplication by name only → deduplicate by ID
5. Inline specialty creation → extract to separate component

## Solution: Approach B (Extract Custom Hook + Components)

### File Structure

```
src/
├── components/
│   ├── assay-definition-dialog.tsx        # Main dialog (~220 lines)
│   ├── assay-definition-dialog/
│   │   ├── specialty-field.tsx            # Select + inline create (~140 lines)
│   │   ├── validation-rules-fields.tsx    # Min/max/type/required (~80 lines)
│   │   └── types.ts                       # Shared types & schemas (~40 lines)
│   └── hooks/
│       └── use-assay-definition-form.ts   # Form logic hook (~120 lines)
```

### Component Breakdown

#### 1. `types.ts` - Zod Schemas & Types

```typescript
import { z } from 'zod'

export const ValidationRulesSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  type: z.enum(['numeric', 'text', 'boolean']).default('numeric'),
  required: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.min !== undefined && data.max !== undefined) {
      return data.min < data.max
    }
    return true
  },
  { message: 'Giá trị tối thiểu phải nhỏ hơn giá trị tối đa', path: ['min'] }
)

export const AssayFormSchema = z.object({
  name: z.string().min(1, 'Tên chỉ tiêu là bắt buộc'),
  specialtyId: z.string().min(1, 'Vui lòng chọn nhóm kỹ thuật'),
  methodId: z.string().optional(),
  units: z.string().optional(),
  validationRules: ValidationRulesSchema.optional(),
})

export type AssayFormValues = z.infer<typeof AssayFormSchema>
export type ValidationRules = z.infer<typeof ValidationRulesSchema>
export type AssayFormMode = 'create' | 'edit'
```

#### 2. `use-assay-definition-form.ts` - Custom Hook

Responsibilities:
- All form state via react-hook-form + Zod resolver
- Submit handlers for create/update
- Methods fetching with ID-based deduplication (fixes Gemini concern)
- Form initialization from existing assay data

Key exports:
```typescript
return {
  form,           // UseFormReturn<AssayFormValues>
  isPending,      // boolean
  methods,        // Method[]
  loadingMethods, // boolean
  loadMethods,    // () => Promise<void>
  onSubmit,       // form.handleSubmit wrapper
  resetForm,      // () => void
}
```

#### 3. `specialty-field.tsx` - Specialty Selection Component

Responsibilities:
- Specialty dropdown selection
- Inline specialty creation form (toggleable)
- Validation error display from parent form
- Callback to parent when new specialty created

Props:
```typescript
type Props = {
  form: UseFormReturn<AssayFormValues>
  specialties: LabSpecialty[]
  onSpecialtyCreated: (specialty: LabSpecialty) => void
  disabled?: boolean
}
```

#### 4. `validation-rules-fields.tsx` - Validation Rules Section

Responsibilities:
- Min/max numeric inputs
- Data type selector (numeric/text/boolean)
- Required checkbox
- Auto-clear min/max when switching to boolean

Props:
```typescript
type Props = {
  form: UseFormReturn<AssayFormValues>
  disabled?: boolean
}
```

#### 5. `assay-definition-dialog.tsx` - Main Dialog (Refactored)

Responsibilities:
- Dialog shell and layout
- Orchestrates child components
- Local specialties state management
- Name and units fields (simple, kept inline)
- Method selection (create mode only)
- AssayMethodsList integration (edit mode)

## Implementation Tasks

1. **Create types.ts** - Zod schemas and type definitions
2. **Create use-assay-definition-form.ts** - Custom form hook
3. **Create specialty-field.tsx** - Extracted specialty component
4. **Create validation-rules-fields.tsx** - Extracted validation component
5. **Refactor assay-definition-dialog.tsx** - Wire up new components
6. **Test the refactored dialog** - Verify create/edit flows work
7. **Run typecheck and lint** - Ensure no regressions

## Line Count Targets

| File | Target Lines |
|------|--------------|
| `assay-definition-dialog.tsx` | ~220 |
| `use-assay-definition-form.ts` | ~120 |
| `specialty-field.tsx` | ~140 |
| `validation-rules-fields.tsx` | ~80 |
| `types.ts` | ~40 |
| **Total** | ~600 |

Main dialog reduced from **602 → ~220 lines** (63% reduction)

## Benefits

1. **Maintainability:** Each file has single responsibility
2. **Reusability:** SpecialtyField can be used in other forms
3. **Testability:** Hook can be unit tested in isolation
4. **Type Safety:** Proper Zod schemas, no `any` casts
5. **Validation:** Schema-level validation with Vietnamese messages

## Testing Checklist

- [ ] Create mode: form validates required fields
- [ ] Create mode: can select specialty from dropdown
- [ ] Create mode: can create specialty inline
- [ ] Create mode: min < max validation works
- [ ] Create mode: submit creates assay successfully
- [ ] Edit mode: form populates with existing data
- [ ] Edit mode: can update assay successfully
- [ ] Edit mode: AssayMethodsList renders correctly
- [ ] Boolean data type clears min/max values
