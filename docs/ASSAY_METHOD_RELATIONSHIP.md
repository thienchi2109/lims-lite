# **Assay-Method Many-to-Many Relationship Design**

## **Executive Summary**

This document proposes a many-to-many relationship between `assay_definitions` and `methods` tables to accurately represent the laboratory domain: **one assay (e.g., Glucose) can be tested using multiple methods (e.g., HPLC, Enzymatic, Spectrophotometry)**.

---

## **1. Problem Statement**

### **Current Schema Issue**

```sql
-- CURRENT: One-to-One (Wrong)
CREATE TABLE assay_definitions (
    id UUID,
    name TEXT,
    method_id UUID REFERENCES methods(id),  -- ❌ Limits to ONE method only
    units TEXT,
    ...
);
```

**Problems:**
- Glucose can only have ONE method (e.g., HPLC)
- If lab wants to use Enzymatic method for Glucose, must create duplicate assay
- Doesn't match real-world laboratory workflows
- Results table already supports multiple methods per assay

### **Real-World Laboratory Scenario**

```
Assay: Glucose
├── Method 1: HPLC (High accuracy, expensive, slow)
├── Method 2: Enzymatic (Medium accuracy, cheap, fast) [DEFAULT]
└── Method 3: Spectrophotometry (Lower accuracy, very cheap, very fast)

Assay: pH
└── Method: Electrode Measurement (only valid method)

Assay: E. coli
├── Method 1: Culture Method (Standard, slow)
└── Method 2: Rapid PCR Method (Fast, expensive)
```

**Key Insight:** The `results` table already has BOTH `assay_id` AND `method_id`, so the backend supports this—only the management UI is missing.

---

## **2. Proposed Solution: Many-to-Many Relationship**

### **2.1 Database Schema Changes**

#### **Step 1: Create Junction Table**

```sql
-- Migration: 010_assay_methods_junction.sql

-- Junction table to link assays with valid methods
CREATE TABLE IF NOT EXISTS public.assay_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assay_id UUID NOT NULL REFERENCES public.assay_definitions(id) ON DELETE CASCADE,
    method_id UUID NOT NULL REFERENCES public.methods(id) ON DELETE RESTRICT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one assay-method pair only
    UNIQUE(assay_id, method_id)
);

-- Index for performance
CREATE INDEX idx_assay_methods_assay_id ON public.assay_methods(assay_id);
CREATE INDEX idx_assay_methods_method_id ON public.assay_methods(method_id);

-- Updated_at trigger
CREATE TRIGGER update_assay_methods_updated_at
    BEFORE UPDATE ON public.assay_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.assay_methods IS 'Many-to-many relationship between assays and valid testing methods';
```

#### **Step 2: Remove Redundant Column**

```sql
-- Remove method_id from assay_definitions (it's now in junction table)
ALTER TABLE public.assay_definitions
DROP COLUMN method_id;
```

#### **Step 3: Add Validation Constraint**

```sql
-- Ensure only ONE default method per assay
CREATE UNIQUE INDEX idx_assay_methods_one_default
ON public.assay_methods (assay_id)
WHERE is_default = true;
```

---

### **2.2 RLS Policies**

```sql
-- All authenticated users can read assay-method relationships
CREATE POLICY "Authenticated users can read assay methods"
ON public.assay_methods FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only managers can manage assay-method relationships
CREATE POLICY "Managers can manage assay methods"
ON public.assay_methods FOR ALL
USING (get_user_role() = 'manager');

-- Enable RLS
ALTER TABLE public.assay_methods ENABLE ROW LEVEL SECURITY;
```

---

## **3. Data Model & TypeScript Types**

### **3.1 Zod Schemas** (`src/types/index.ts`)

```typescript
// ============================================================================
// ASSAY-METHOD JUNCTION SCHEMAS
// ============================================================================

export const AssayMethodSchema = z.object({
    id: z.string().uuid(),
    assay_id: z.string().uuid(),
    method_id: z.string().uuid(),
    is_default: z.boolean(),
    notes: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type AssayMethod = z.infer<typeof AssayMethodSchema>

export const CreateAssayMethodSchema = z.object({
    assay_id: z.string().uuid(),
    method_id: z.string().uuid(),
    is_default: z.boolean().default(false),
    notes: z.string().optional(),
})

export type CreateAssayMethod = z.infer<typeof CreateAssayMethodSchema>

// Extended assay definition with methods
export const AssayDefinitionWithMethodsSchema = AssayDefinitionSchema.extend({
    methods: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        is_default: z.boolean(),
        notes: z.string().nullable(),
    })),
})

export type AssayDefinitionWithMethods = z.infer<typeof AssayDefinitionWithMethodsSchema>
```

---

## **4. CRUD Operations**

### **4.1 Server Actions** (`src/app/actions/assay-methods.ts`)

```typescript
'use server'

// ============================================================================
// GET METHODS FOR AN ASSAY
// ============================================================================
export async function getMethodsForAssay(assayId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('assay_methods')
        .select(`
            id,
            method_id,
            is_default,
            notes,
            methods (
                id,
                name,
                description
            )
        `)
        .eq('assay_id', assayId)
        .order('is_default', { ascending: false })  // Default first
        .order('methods.name', { ascending: true })

    return { data, error }
}

// ============================================================================
// ADD METHOD TO ASSAY
// ============================================================================
export async function addMethodToAssay(formData: FormData) {
    const supabase = await createClient()

    // Validate user is manager
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'manager') {
        return { error: 'Chỉ Quản lý mới có thể thêm phương pháp' }
    }

    // Parse and validate
    const rawData = {
        assay_id: formData.get('assay_id'),
        method_id: formData.get('method_id'),
        is_default: formData.get('is_default') === 'true',
        notes: formData.get('notes') || undefined,
    }

    const result = CreateAssayMethodSchema.safeParse(rawData)
    if (!result.success) {
        return { error: 'Dữ liệu không hợp lệ', details: result.error.flatten() }
    }

    // If setting as default, unset other defaults first
    if (result.data.is_default) {
        await supabase
            .from('assay_methods')
            .update({ is_default: false })
            .eq('assay_id', result.data.assay_id)
    }

    // Insert relationship
    const { data, error } = await supabase
        .from('assay_methods')
        .insert({
            assay_id: result.data.assay_id,
            method_id: result.data.method_id,
            is_default: result.data.is_default,
            notes: result.data.notes || null,
        })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {  // Unique violation
            return { error: 'Phương pháp này đã được thêm vào chỉ tiêu' }
        }
        return { error: error.message }
    }

    revalidatePath('/manager/assays')
    return { success: true, data }
}

// ============================================================================
// REMOVE METHOD FROM ASSAY
// ============================================================================
export async function removeMethodFromAssay(assayMethodId: string) {
    const supabase = await createClient()

    // Validate user is manager
    // ... (similar to above)

    // Check if this is the last method for the assay
    const { data: assayMethod } = await supabase
        .from('assay_methods')
        .select('assay_id')
        .eq('id', assayMethodId)
        .single()

    if (assayMethod) {
        const { count } = await supabase
            .from('assay_methods')
            .select('id', { count: 'exact', head: true })
            .eq('assay_id', assayMethod.assay_id)

        if (count === 1) {
            return { error: 'Không thể xóa phương pháp cuối cùng. Mỗi chỉ tiêu phải có ít nhất một phương pháp.' }
        }
    }

    // Delete relationship
    const { error } = await supabase
        .from('assay_methods')
        .delete()
        .eq('id', assayMethodId)

    if (error) return { error: error.message }

    revalidatePath('/manager/assays')
    return { success: true }
}

// ============================================================================
// SET DEFAULT METHOD FOR ASSAY
// ============================================================================
export async function setDefaultMethod(assayId: string, methodId: string) {
    const supabase = await createClient()

    // Validate user is manager
    // ... (similar to above)

    // Unset all defaults for this assay
    await supabase
        .from('assay_methods')
        .update({ is_default: false })
        .eq('assay_id', assayId)

    // Set this one as default
    const { error } = await supabase
        .from('assay_methods')
        .update({ is_default: true })
        .eq('assay_id', assayId)
        .eq('method_id', methodId)

    if (error) return { error: error.message }

    revalidatePath('/manager/assays')
    return { success: true }
}
```

---

## **5. UI/UX Flow**

### **5.1 Updated Assay Management Page**

**Before (Current):**
```
[Table: Assay Name | Method | Units | Actions]
Glucose | HPLC | mg/dL | [Edit] [Delete]
```

**After (Proposed):**
```
[Expandable Table with nested methods]
Glucose | mg/dL | [Edit] [Delete] [▼]
  └─ Methods (3):
     • HPLC (Default) ⭐ [Remove]
     • Enzymatic [Set Default] [Remove]
     • Spectrophotometry [Set Default] [Remove]
     [+ Add Method]

pH | - | [Edit] [Delete] [▼]
  └─ Methods (1):
     • Electrode Method (Default) ⭐ [Remove]
     [+ Add Method]
```

### **5.2 Component Structure**

```
AssayDefinitionsTable (existing)
├── AssayDefinitionRow (new)
│   ├── Assay basic info
│   └── MethodsList (new - expandable)
│       ├── MethodItem (new)
│       │   ├── Method name
│       │   ├── Default badge
│       │   ├── Set Default button
│       │   └── Remove button
│       └── AddMethodButton
│           └── AddMethodToAssayDialog (new)
└── AssayDefinitionDialog (updated - remove method field)
```

### **5.3 New Dialogs**

#### **AddMethodToAssayDialog**
```typescript
// Fields:
- Assay (read-only, pre-filled)
- Method (dropdown - only show methods NOT already added)
- Set as Default? (checkbox)
- Notes (optional textarea)
```

#### **Confirmation Dialog**
```typescript
// When removing a method used in existing results:
"Warning: This method is used in X existing results.
Are you sure you want to remove it from this assay?
(Existing results will not be affected)"
```

---

## **6. Validation Rules**

### **6.1 Business Rules**

1. **Each assay MUST have at least ONE method**
   - Cannot delete the last method from an assay
   - When creating assay, must add at least one method (or auto-add a default)

2. **Each assay can have ONLY ONE default method**
   - Enforced by unique index
   - Setting new default automatically unsets previous default

3. **Cannot add duplicate assay-method pairs**
   - Enforced by unique constraint
   - UI should grey out already-added methods

4. **Method deletion protection**
   - If method is used in `assay_methods`, show warning before deletion
   - Consider CASCADE vs RESTRICT based on lab policy

### **6.2 Database Constraints**

```sql
-- Constraint 1: Unique assay-method pair
UNIQUE(assay_id, method_id)

-- Constraint 2: Only one default per assay
CREATE UNIQUE INDEX idx_assay_methods_one_default
ON public.assay_methods (assay_id)
WHERE is_default = true;

-- Constraint 3: Cannot delete method in use
-- ON DELETE RESTRICT on method_id foreign key

-- Constraint 4: Cascading delete when assay is deleted
-- ON DELETE CASCADE on assay_id foreign key
```

---

## **7. Impact on Existing Features**

### **7.1 Test Assignment** (`test-assignment-dialog.tsx`)

**Current:**
```typescript
// Only select assay
{ sampleId: "...", assayIds: ["glucose-id", "ph-id"] }
```

**After:**
```typescript
// Must select BOTH assay AND method
{
    sampleId: "...",
    tests: [
        { assayId: "glucose-id", methodId: "hplc-001" },  // Chose HPLC
        { assayId: "ph-id", methodId: "electrode-001" }   // Only option
    ]
}
```

**UI Changes:**
- When selecting an assay, show a **sub-dropdown** for method selection
- Pre-select the **default method** for convenience
- Show method names with descriptions as tooltips

### **7.2 Results Entry** (`results-grid.tsx`)

**Current:**
```typescript
// Results already have method_id
{ assay_id, method_id, value }
```

**After:**
- **No changes needed** (already supports this!)
- Display method name alongside assay name in grid
- Allow filtering results by method

### **7.3 Approval Queue** (`approval-queue-table.tsx`)

**Current:**
```typescript
// Show: Sample ID | Assay Name | Result
S-001 | Glucose | 95 mg/dL
```

**After:**
```typescript
// Show: Sample ID | Assay Name | Method | Result
S-001 | Glucose | HPLC | 95 mg/dL
S-002 | Glucose | Enzymatic | 102 mg/dL  // Same assay, different method
```

---

## **8. Migration Strategy**

### **8.1 Data Migration Steps**

```sql
-- Step 1: Create new tables
CREATE TABLE assay_methods (...);

-- Step 2: Migrate existing data
-- For each assay that has a method_id, create junction record
INSERT INTO assay_methods (assay_id, method_id, is_default)
SELECT id, method_id, true
FROM assay_definitions
WHERE method_id IS NOT NULL;

-- Step 3: For assays without methods, assign a default method
-- (Requires manual review or script)

-- Step 4: Verify all assays have at least one method
SELECT a.id, a.name, COUNT(am.id) as method_count
FROM assay_definitions a
LEFT JOIN assay_methods am ON a.id = am.assay_id
GROUP BY a.id, a.name
HAVING COUNT(am.id) = 0;

-- Step 5: Drop old column
ALTER TABLE assay_definitions DROP COLUMN method_id;
```

### **8.2 Rollback Plan**

```sql
-- If needed to rollback:
ALTER TABLE assay_definitions ADD COLUMN method_id UUID REFERENCES methods(id);

-- Copy default method back
UPDATE assay_definitions a
SET method_id = am.method_id
FROM assay_methods am
WHERE a.id = am.assay_id AND am.is_default = true;

-- Drop junction table
DROP TABLE assay_methods;
```

---

## **9. Testing Checklist**

### **9.1 Unit Tests**

- [ ] Create assay-method relationship
- [ ] Prevent duplicate assay-method pairs
- [ ] Enforce only one default per assay
- [ ] Prevent deletion of last method
- [ ] Cascade delete when assay is deleted
- [ ] Restrict delete when method is in use

### **9.2 Integration Tests**

- [ ] Assign test with method to sample
- [ ] Enter results for multiple methods of same assay
- [ ] Approve results grouped by assay+method
- [ ] Generate report showing method used

### **9.3 Manual Testing**

- [ ] Create Glucose assay
- [ ] Add HPLC method (set as default)
- [ ] Add Enzymatic method
- [ ] Assign Glucose to sample, choose HPLC
- [ ] Enter result for Glucose-HPLC
- [ ] Try to delete HPLC (should show warning)
- [ ] Set Enzymatic as new default
- [ ] Verify test assignment shows Enzymatic pre-selected

---

## **10. Example Seed Data**

```sql
-- Seed assay-method relationships

-- Glucose (3 methods)
INSERT INTO assay_methods (assay_id, method_id, is_default, notes) VALUES
(
    (SELECT id FROM assay_definitions WHERE name = 'Glucose'),
    (SELECT id FROM methods WHERE name = 'HPLC'),
    true,
    'Most accurate method, use for regulatory samples'
),
(
    (SELECT id FROM assay_definitions WHERE name = 'Glucose'),
    (SELECT id FROM methods WHERE name = 'Enzymatic Assay'),
    false,
    'Faster turnaround, acceptable for routine testing'
),
(
    (SELECT id FROM assay_definitions WHERE name = 'Glucose'),
    (SELECT id FROM methods WHERE name = 'Spectrophotometry'),
    false,
    'Quick screening only'
);

-- pH (1 method)
INSERT INTO assay_methods (assay_id, method_id, is_default, notes) VALUES
(
    (SELECT id FROM assay_definitions WHERE name = 'pH'),
    (SELECT id FROM methods WHERE name = 'Electrode Measurement'),
    true,
    'Standard pH meter method'
);

-- E. coli (2 methods)
INSERT INTO assay_methods (assay_id, method_id, is_default, notes) VALUES
(
    (SELECT id FROM assay_definitions WHERE name = 'E. coli'),
    (SELECT id FROM methods WHERE name = 'Culture Method'),
    true,
    'Standard culture method, 24-48 hours'
),
(
    (SELECT id FROM assay_definitions WHERE name = 'E. coli'),
    (SELECT id FROM methods WHERE name = 'Rapid PCR'),
    false,
    'Emergency samples only, expensive'
);
```

---

## **11. Advantages of This Approach**

✅ **Domain Accuracy**
- Matches real laboratory workflows
- One assay can have multiple testing methods
- Each method has different characteristics (speed, cost, accuracy)

✅ **Flexibility**
- Lab can add new methods to existing assays without code changes
- Easy to mark preferred/default methods
- Notes field for method-specific instructions

✅ **Traceability**
- Results table already tracks which method was used
- Can compare results from different methods for same assay
- Audit trail shows method-specific approvals

✅ **Scalability**
- Easy to add method-specific validation rules later
- Can track method-specific turnaround times
- Supports advanced features (method-based pricing, equipment assignment)

---

## **12. Implementation Phases**

### **Phase 1: Database Changes** (Week 1)
- [ ] Create migration for `assay_methods` table
- [ ] Add RLS policies
- [ ] Migrate existing data
- [ ] Remove old `method_id` column

### **Phase 2: Backend Actions** (Week 1)
- [ ] Create `assay-methods.ts` server actions
- [ ] Update existing assay actions to handle methods
- [ ] Add validation logic

### **Phase 3: UI Components** (Week 2)
- [ ] Update `AssayDefinitionsTable` to show methods list
- [ ] Create `AddMethodToAssayDialog`
- [ ] Create `MethodsList` expandable component
- [ ] Update `AssayDefinitionDialog` (remove single method field)

### **Phase 4: Integration** (Week 2)
- [ ] Update test assignment to select method
- [ ] Update results display to show method
- [ ] Update approval queue to include method
- [ ] Update seed data

### **Phase 5: Testing & Deployment** (Week 3)
- [ ] Manual testing with sample data
- [ ] Fix any edge cases
- [ ] Deploy to production

---

## **13. Open Questions for Review**

1. **Should every assay require at least one method?**
   - Current proposal: YES (enforced)
   - Alternative: Allow "methodless" assays for flexibility?

2. **What happens to existing results if we remove a method?**
   - Proposal: Keep results (RESTRICT on method deletion)
   - Alternative: Soft-delete methods instead?

3. **Should analysts be able to SEE all methods but only managers EDIT?**
   - Proposal: YES (analysts need to know valid methods for test assignment)

4. **Do we need method-specific validation rules?**
   - Current: validation_rules on assay level
   - Future: Move to assay_methods level for method-specific rules?

5. **Should we track which user added which method to an assay?**
   - Current proposal: No tracking
   - Alternative: Add `added_by` and `added_at` fields?

---

## **Conclusion**

This many-to-many relationship design accurately models the laboratory domain where one assay (e.g., Glucose) can be tested using multiple methods (HPLC, Enzymatic, etc.). The implementation is backwards-compatible with the existing `results` table and requires only:

1. Adding a junction table
2. Updating CRUD UI for assay-method management
3. Enhancing test assignment to select methods

**Next Steps:**
- Review this document
- Approve/modify the approach
- Begin Phase 1 implementation

---

**Document Version:** 1.0
**Date:** 2025-11-27
**Author:** Claude (AI Assistant)
**Status:** ⏳ Awaiting Review
