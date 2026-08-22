# Phase 1: Design & Decisions - CONFIRMED
**Feature**: Add Clients Table and Link to Samples
**Date**: 2025-12-10
**Status**: ✅ READY FOR IMPLEMENTATION

---

## Task 1.1: QR Payload Mapping - CONFIRMED ✅

### QR Payload Format (Vietnamese ID Card)
**⚠️ ACTUAL FORMAT** (immutable, from real ID card scans):
```
Format: id_card_num|health_insurance_num|name|DDMMYYYY|gender|
Example: 086094006827|331757192|NGUYỄN THIỆN CHÍ|21091994|Nam|
```

**Key Detail**: Date has **NO SLASHES** in raw QR payload (e.g., `21091994`)

### Field Mapping Table

| QR Segment | Index | Target Table | Target Column | Transformation | Validation |
|------------|-------|--------------|---------------|----------------|------------|
| ID Card Number | 0 | `clients` | `id_card_num` | Store as-is (TEXT) | Required, non-empty |
| Health Insurance | 1 | - | - | **IGNORED** | Not stored |
| Full Name | 2 | `clients` | `name` | Store as-is (TEXT) | Required, non-empty |
| Date of Birth | 3 | `clients` | `date_of_birth` | `DDMMYYYY` → `DATE` | Required, 8 digits, valid date |
| Gender | 4 | `clients` | `gender` | Store as-is (TEXT) | Must be in `{'Nam','Nữ','Khác'}` |
| Phone | Manual Entry | `clients` | `phone` | Validate format | Required, match `^(0|\+84)[0-9]{9,10}$` |

### Parsing Logic Specification

**Input**: QR payload string (pipe-delimited)
**Output**: Client data object or validation error

```typescript
interface QRPayload {
  id_card_num: string;      // Segment 0
  name: string;              // Segment 2
  date_of_birth: Date;       // Segment 3 (converted from DDMMYYYY)
  gender: 'Nam' | 'Nữ' | 'Khác'; // Segment 4
}

// Parsing algorithm:
// 1. Split string by '|'
// 2. Validate segment count >= 5
// 3. Extract segments [0, 2, 3, 4] (skip segment 1 = health insurance)
// 4. Parse segment 3 (birthdateStr):
//    a. Validate length === 8 (e.g., "21091994")
//    b. Extract: day = birthdateStr.slice(0,2), month = birthdateStr.slice(2,4), year = birthdateStr.slice(4,8)
//    c. Convert to ISO format: YYYY-MM-DD (e.g., "1994-09-21")
//    d. Validate date is valid (e.g., not 31/02/1994)
// 5. Validate gender against allowed list
// 6. Prompt for phone number (manual entry)
// 7. Upsert client using UNIQUE(name, date_of_birth)
// 8. Return client_id for sample linkage
```

### Date Conversion Specification

**QR Format**: `DDMMYYYY` (8 digits, no slashes - e.g., `21091994`)
**PostgreSQL Format**: `DATE` type (e.g., `1994-09-21`)

**Parsing Steps**:
```javascript
// Input: "21091994"
const birthdateStr = "21091994";

// Step 1: Validate length
if (birthdateStr.length !== 8) {
  throw new Error("Invalid date format: must be 8 digits");
}

// Step 2: Extract components
const day = birthdateStr.slice(0, 2);    // "21"
const month = birthdateStr.slice(2, 4);  // "09"
const year = birthdateStr.slice(4, 8);   // "1994"

// Step 3: Build ISO date string
const isoDate = `${year}-${month}-${day}`; // "1994-09-21"

// Step 4: Validate date is valid
const dateObj = new Date(isoDate);
if (isNaN(dateObj.getTime())) {
  throw new Error("Invalid date");
}

// Result: Date object representing 1994-09-21
```

**Validation Rules**:
- Input must be exactly 8 digits
- Day: 01-31 (depends on month)
- Month: 01-12
- Year: 1900-2100 (reasonable range for human DOB)
- Reject invalid dates (e.g., `31021994` = Feb 31st)

### Allowed Values Lists

#### Gender Values (CHECK Constraint)
```sql
CHECK (gender IN ('Nam', 'Nữ', 'Khác'))
```
- `'Nam'` = Male
- `'Nữ'` = Female
- `'Khác'` = Other/Unspecified

#### Sample Type Values (CHECK Constraint)
```sql
CHECK (type IN (
  'Máu',                        -- Blood
  'Dịch niệu đạo/âm đạo',      -- Urethral/vaginal discharge
  'Nước tiểu',                  -- Urine
  'Phết tế bào âm đạo',        -- Vaginal cytology smear
  'Ngoáy trực tràng/hậu môn',  -- Rectal/anal swab
  'Phân',                       -- Feces
  'Nước',                       -- Water
  'Thực phẩm'                   -- Food
))
```

---

## Task 1.2: Database Constraints - CONFIRMED ✅

### `clients` Table Schema

```sql
CREATE TABLE IF NOT EXISTS public.clients (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Required Identity Fields
    id_card_num TEXT NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL,
    phone TEXT NOT NULL,
    
    -- Optional Fields
    address TEXT,
    health_insurance_num TEXT,
    expiry_date DATE,
    
    -- Audit Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT clients_gender_check CHECK (gender IN ('Nam', 'Nữ', 'Khác')),
    CONSTRAINT clients_phone_format_check CHECK (phone ~ '^(0|\+84)[0-9]{9,10}$'),
    CONSTRAINT clients_unique_identity UNIQUE (name, date_of_birth)
);
```

#### Constraints Breakdown

| Constraint Type | Column(s) | Rule | Rationale |
|----------------|-----------|------|-----------|
| NOT NULL | `id_card_num` | Must be provided | Required for identity verification |
| NOT NULL | `name` | Must be provided | Core identity field |
| NOT NULL | `date_of_birth` | Must be provided | Core identity field |
| NOT NULL | `gender` | Must be provided | Required for QR intake |
| NOT NULL | `phone` | Must be provided | Required for CoA access (passcode = last 6 digits) |
| CHECK | `gender` | Must be `'Nam'`, `'Nữ'`, or `'Khác'` | Standardized values |
| CHECK | `phone` | Format: `^(0|\+84)[0-9]{9,10}$` | Vietnamese phone validation |
| UNIQUE | `(name, date_of_birth)` | No duplicates allowed | Prevent duplicate client records |

**Why UNIQUE on (name, DOB) instead of id_card_num?**
- ID cards can be renewed/reissued with different numbers
- (name, DOB) is more stable for identity
- `id_card_num` is stored for verification but not uniqueness

### `samples` Table Changes

```sql
-- NEW COLUMNS
ALTER TABLE public.samples ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.samples ADD COLUMN IF NOT EXISTS type TEXT;

-- CONSTRAINTS (applied after backfill)
ALTER TABLE public.samples 
  ALTER COLUMN client_id SET NOT NULL,
  ADD CONSTRAINT samples_client_fk FOREIGN KEY (client_id) REFERENCES clients(id),
  ALTER COLUMN client_name SET NOT NULL,
  ADD CONSTRAINT samples_type_check CHECK (type IN (
    'Máu',
    'Dịch niệu đạo/âm đạo',
    'Nước tiểu',
    'Phết tế bào âm đạo',
    'Ngoáy trực tràng/hậu môn',
    'Phân',
    'Nước',
    'Thực phẩm'
  ));
```

#### `samples` Constraints Summary

| Constraint Type | Column | Rule | Change Type |
|----------------|--------|------|-------------|
| NOT NULL | `client_id` | Must be provided | NEW ✨ |
| FOREIGN KEY | `client_id` | Must reference valid client | NEW ✨ |
| NOT NULL | `client_name` | Must be provided | ENFORCED (was nullable) ⚠️ |
| CHECK | `type` | Must be in allowed sample types list | NEW ✨ |
| (unchanged) | `status` | Keep `sample_status` enum | NO CHANGE ✅ |

### Triggers Specification

#### 1. `clients` Table Triggers

```sql
-- Updated_at trigger (auto-update timestamp)
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger (track all changes)
CREATE TRIGGER audit_clients_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();
```

#### 2. `samples` Table New Trigger

```sql
-- Auto-fill client_name snapshot from clients table
CREATE OR REPLACE FUNCTION sync_client_name_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    -- When client_id is provided, auto-fill client_name from clients table
    IF NEW.client_id IS NOT NULL THEN
        SELECT name INTO NEW.client_name
        FROM public.clients
        WHERE id = NEW.client_id;
        
        -- If client not found, raise error (FK constraint should catch this too)
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client with id % not found', NEW.client_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_samples_client_name
  BEFORE INSERT OR UPDATE OF client_id ON public.samples
  FOR EACH ROW
  EXECUTE FUNCTION sync_client_name_snapshot();
```

**Trigger Behavior**:
- Fires on INSERT or UPDATE when `client_id` changes
- Auto-fills `client_name` from `clients.name`
- Prevents manual `client_name` editing (always synced from source)
- Ensures historical snapshot is always accurate

### Indexes for Performance

```sql
-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_name_dob ON public.clients(name, date_of_birth);
CREATE INDEX IF NOT EXISTS idx_clients_id_card_num ON public.clients(id_card_num);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);

-- Samples table indexes
CREATE INDEX IF NOT EXISTS idx_samples_client_id ON public.samples(client_id);
CREATE INDEX IF NOT EXISTS idx_samples_type ON public.samples(type);
```

---

## Task 1.3: RLS Policy Matrix - CONFIRMED ✅

### Current Samples Policies (Baseline)

| Policy Name | Operation | Role | Condition |
|------------|-----------|------|-----------|
| "Authenticated users can read samples" | SELECT | All | `auth.uid() IS NOT NULL AND deleted_at IS NULL` |
| "Managers can insert samples" | INSERT | Manager | `get_user_role() = 'manager'` |
| "Analysts can insert own samples" | INSERT | Analyst | *(from migration 015)* |
| "Managers can update samples" | UPDATE | Manager | `get_user_role() = 'manager'` |
| "Analysts can update own samples" | UPDATE | Analyst | *(from migration 020)* |
| "Analysts can start samples" | UPDATE | Analyst | *(from migration 027)* |
| "Managers can delete samples" | DELETE | Manager | `get_user_role() = 'manager'` |

### NEW: `clients` Table RLS Policies

**Enable RLS**:
```sql
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
```

#### Policy Matrix for `clients`

| Policy Name | Operation | Role | Rule | Rationale |
|------------|-----------|------|------|-----------|
| "Authenticated users can read clients" | SELECT | All (Analyst + Manager) | `auth.uid() IS NOT NULL` | Everyone needs to see client list for sample intake |
| "Analysts can create clients" | INSERT | Analyst + Manager | `get_user_role() IN ('analyst', 'manager')` | Analysts need to create clients during QR intake |
| "Managers can update clients" | UPDATE | Manager only | `get_user_role() = 'manager'` | Only managers can edit client records after creation |
| "Managers can delete clients" | DELETE | Manager only | `get_user_role() = 'manager'` | Only managers can remove clients (soft delete preferred) |

#### SQL Implementation

```sql
-- Drop existing policies if any (migration safety pattern)
DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.clients;
DROP POLICY IF EXISTS "Analysts can create clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can update clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can delete clients" ON public.clients;

-- SELECT: All authenticated users can read clients
CREATE POLICY "Authenticated users can read clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: Analysts and managers can create clients
CREATE POLICY "Analysts can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (get_user_role() IN ('analyst', 'manager'));

-- UPDATE: Only managers can update clients
CREATE POLICY "Managers can update clients"
  ON public.clients FOR UPDATE
  USING (get_user_role() = 'manager')
  WITH CHECK (get_user_role() = 'manager');

-- DELETE: Only managers can delete clients
CREATE POLICY "Managers can delete clients"
  ON public.clients FOR DELETE
  USING (get_user_role() = 'manager');
```

### Updated: `samples` Table RLS Changes

**⚠️ NO BREAKING CHANGES** - existing policies remain functional

The `client_id` FK constraint is transparent to RLS. Existing policies don't need modification because:
- Clients are readable by all authenticated users (no access barrier)
- Sample INSERT/UPDATE policies already have role checks
- FK constraint enforces data integrity independently

**Optional Enhancement** (Future):
```sql
-- Could add explicit check that user can read the linked client
-- But not necessary since clients table is fully readable
```

### Security Impact Assessment

| Area | Security Impact | Risk Level | Mitigation |
|------|----------------|------------|------------|
| Client data exposure | All authenticated users can read all clients | **LOW** | Acceptable - needed for sample intake workflow |
| Client creation | Analysts can create clients via QR intake | **LOW** | Acceptable - analysts are trusted users |
| Client modification | Only managers can edit client records | **MINIMAL** | Good isolation - prevents accidental edits |
| Sample linkage | Samples MUST link to valid clients (FK) | **MINIMAL** | FK constraint prevents orphaned records |
| Audit coverage | All client changes logged via trigger | **MINIMAL** | Full auditability per 21 CFR Part 11 |

### Migration Security Checklist Compliance

✅ **Pre-Migration**:
- [x] Reviewed existing samples policies
- [x] Documented current policy names
- [x] No orphaned policies identified
- [x] Security analysis completed

✅ **Policy Design**:
- [x] All policies include role checks (`get_user_role()`)
- [x] Policies use `DROP IF EXISTS` before `CREATE`
- [x] Idempotent SQL (safe to re-run)
- [x] Clear comments explaining each policy

✅ **Security Impact**:
- [x] Impact level: **LOW** (read-all acceptable for workflow)
- [x] Changes documented above
- [x] No breaking changes to existing samples policies

✅ **Post-Migration Plan**:
- [ ] Run `run_security_tests()` (Phase 2, Task 2.5)
- [ ] Verify all policies created successfully
- [ ] Test analyst can create client via QR
- [ ] Test manager can edit client
- [ ] Test analyst CANNOT edit client

---

## Summary & Readiness Checklist

### ✅ Task 1.1: QR Payload Mapping
- [x] Confirmed QR format: `id_card|health_ins|name|dd/mm/yyyy|gender|`
- [x] Mapping table documented (6 fields → clients table)
- [x] Date conversion specified (dd/mm/yyyy → DATE)
- [x] Gender allowed list: `{'Nam','Nữ','Khác'}`
- [x] Sample type allowed list: 8 Vietnamese sample types
- [x] Phone validation format: `^(0|\+84)[0-9]{9,10}$`

### ✅ Task 1.2: Database Constraints
- [x] `clients` table schema finalized (11 columns)
- [x] NOT NULL columns identified (5 required fields)
- [x] CHECK constraints defined (gender, phone format)
- [x] UNIQUE constraint: `(name, date_of_birth)`
- [x] `samples` changes specified (client_id FK, type CHECK, client_name NOT NULL)
- [x] Triggers documented (updated_at, audit, client_name snapshot)
- [x] Indexes planned (performance optimization)

### ✅ Task 1.3: RLS Policy Matrix
- [x] Clients policies defined (4 policies)
- [x] Samples policies reviewed (no breaking changes)
- [x] Role checks included in all policies
- [x] DROP/CREATE pattern documented
- [x] Security impact assessed (LOW risk)
- [x] Migration security checklist completed

---

## Next Steps → Phase 2: Database Migration

**Status**: 🟢 READY TO PROCEED

All design decisions are confirmed. The specification is complete and ready for SQL migration implementation.

**Phase 2 Files to Create**:
1. `039_add_clients_table.sql` - Create clients table with constraints/triggers/RLS
2. `040_update_samples_for_clients.sql` - Add client_id, type, snapshot trigger
3. `041_backfill_clients_from_samples.sql` - Data migration with placeholders
4. Security validation after migration

**Estimated Implementation Time**: 2-3 hours
**Risk Level**: Medium (backfill requires testing, but well-defined strategy)
**Compliance Impact**: None (maintains 21 CFR Part 11 auditability)
