## 1. Database Schema

### 1.1 Core Tables
- [ ] 1.1.1 Create migration file `XXX_create_runsheets.sql`
- [ ] 1.1.2 Define `runsheet_status` enum (`draft`, `running`, `completed`, `voided`)
- [ ] 1.1.3 Define `well_type` enum (`sample`, `blank`, `standard`, `control`, `empty`)
- [ ] 1.1.4 Create `runsheets` table with all columns
- [ ] 1.1.5 Create `runsheet_wells` table with FK constraints
- [ ] 1.1.6 Add unique constraint on `(runsheet_id, position)`
- [ ] 1.1.7 Add unique constraint on `(runsheet_id, result_id)` WHERE result_id IS NOT NULL
- [ ] 1.1.8 Create index on `runsheet_wells(runsheet_id, row_index, col_index)`
- [ ] 1.1.9 Add `search_vector` for plate number search (optional)

### 1.2 RLS Policies
- [ ] 1.2.1 Create SELECT policy for runsheets (analysts see own, managers see all)
- [ ] 1.2.2 Create INSERT policy for runsheets (analysts and managers)
- [ ] 1.2.3 Create UPDATE policy for runsheets (analysts own draft, managers all)
- [ ] 1.2.4 Create DELETE policy for runsheets (soft delete only)
- [ ] 1.2.5 Create policies for runsheet_wells (inherit from parent runsheet)

### 1.3 RPC Functions
- [ ] 1.3.1 Create `create_runsheet()` - initializes plate with 96 empty wells
- [ ] 1.3.2 Create `assign_wells()` - batch assign results to well positions
- [ ] 1.3.3 Create `clear_wells()` - batch clear selected wells
- [ ] 1.3.4 Create `update_well_type()` - change well type (blank/standard/etc)
- [ ] 1.3.5 Create `exclude_well()` - mark well as excluded with reason
- [ ] 1.3.6 Create `get_eligible_samples()` - fetch samples available for plate

### 1.4 Audit Triggers
- [ ] 1.4.1 Add audit trigger on `runsheets` table
- [ ] 1.4.2 Add audit trigger on `runsheet_wells` table

### 1.5 Apply & Verify
- [ ] 1.5.1 Apply migration via Docker
- [ ] 1.5.2 Restart PostgREST for new RPC functions
- [ ] 1.5.3 Run security tests
- [ ] 1.5.4 Verify with `npm run typecheck`

## 2. TypeScript Types

### 2.1 Schema Definitions
- [ ] 2.1.1 Add `RunsheetStatus` enum to `src/types/index.ts`
- [ ] 2.1.2 Add `WellType` enum to `src/types/index.ts`
- [ ] 2.1.3 Create `RunsheetSchema` Zod schema
- [ ] 2.1.4 Create `RunsheetWellSchema` Zod schema
- [ ] 2.1.5 Create `WellPosition` type (literal union 'A1' | 'A2' | ... | 'H12')
- [ ] 2.1.6 Create `RunsheetWithWells` combined schema for queries
- [ ] 2.1.7 Create `EligibleSample` type for sample picker

### 2.2 Generate Types
- [ ] 2.2.1 Run `mcp__supabase__generate_typescript_types` to update database types

## 3. Server Actions

### 3.1 Create Actions File
- [ ] 3.1.1 Create `src/app/actions/runsheets.ts`
- [ ] 3.1.2 Implement `createRunsheet()` action
- [ ] 3.1.3 Implement `getRunsheet()` action
- [ ] 3.1.4 Implement `listRunsheets()` action with pagination
- [ ] 3.1.5 Implement `assignWells()` action
- [ ] 3.1.6 Implement `clearWells()` action
- [ ] 3.1.7 Implement `updateWellType()` action
- [ ] 3.1.8 Implement `excludeWell()` action
- [ ] 3.1.9 Implement `updateRunsheetStatus()` action
- [ ] 3.1.10 Implement `voidRunsheet()` action (soft delete)
- [ ] 3.1.11 Implement `getEligibleSamples()` action

### 3.2 API Client Integration
- [ ] 3.2.1 Add runsheet endpoints to `src/lib/api-client.ts`
- [ ] 3.2.2 Add runsheet routes to `/api/client-actions/route.ts`

## 4. UI Components

### 4.1 Plate Grid Component
- [ ] 4.1.1 Create `src/components/runsheet/plate-grid.tsx`
- [ ] 4.1.2 Implement 8x12 grid layout with row/column headers
- [ ] 4.1.3 Add well selection (single, shift, ctrl, marquee)
- [ ] 4.1.4 Add row/column header click selection
- [ ] 4.1.5 Implement keyboard navigation (arrow keys, tab)
- [ ] 4.1.6 Add color coding by well type
- [ ] 4.1.7 Add visual state for excluded wells

### 4.2 Well Cell Component
- [ ] 4.2.1 Create `src/components/runsheet/well-cell.tsx`
- [ ] 4.2.2 Display sample ID when assigned
- [ ] 4.2.3 Show well type indicator (color/icon)
- [ ] 4.2.4 Add hover tooltip with full details
- [ ] 4.2.5 Handle selection state styling
- [ ] 4.2.6 Handle excluded state styling (strikethrough/dim)

### 4.3 Sample Picker Component
- [ ] 4.3.1 Create `src/components/runsheet/sample-picker.tsx`
- [ ] 4.3.2 Implement virtualized sample list
- [ ] 4.3.3 Add search functionality
- [ ] 4.3.4 Add multi-select with checkboxes
- [ ] 4.3.5 Show sample metadata (type, received date)
- [ ] 4.3.6 Add "Assign Selected" button

### 4.4 Runsheet Toolbar Component
- [ ] 4.4.1 Create `src/components/runsheet/runsheet-toolbar.tsx`
- [ ] 4.4.2 Add assay/method selector dropdowns
- [ ] 4.4.3 Add "Lưu" (Save) button
- [ ] 4.4.4 Add "Điền theo hàng" (Fill by Row) button
- [ ] 4.4.5 Add "Điền theo cột" (Fill by Column) button
- [ ] 4.4.6 Add "Xóa chọn" (Clear Selected) button
- [ ] 4.4.7 Add well type selector (for selected wells)
- [ ] 4.4.8 Add plate status indicator

### 4.5 Well Legend Component
- [ ] 4.5.1 Create `src/components/runsheet/well-legend.tsx`
- [ ] 4.5.2 Show color key for all well types
- [ ] 4.5.3 Show count of each type on current plate

### 4.6 Runsheet Editor Container
- [ ] 4.6.1 Create `src/components/runsheet/runsheet-editor.tsx`
- [ ] 4.6.2 Implement state management for plate editing
- [ ] 4.6.3 Wire up all child components
- [ ] 4.6.4 Handle save/cancel actions
- [ ] 4.6.5 Add unsaved changes warning

## 5. Pages

### 5.1 Runsheet List Page
- [ ] 5.1.1 Create `src/app/(dashboard)/analyst/runsheets/page.tsx`
- [ ] 5.1.2 Implement paginated table of runsheets
- [ ] 5.1.3 Add status filter
- [ ] 5.1.4 Add "Tạo mới" (Create New) button
- [ ] 5.1.5 Add row actions (view, void)

### 5.2 Create Runsheet Page
- [ ] 5.2.1 Create `src/app/(dashboard)/analyst/runsheets/new/page.tsx`
- [ ] 5.2.2 Implement assay/method selection step
- [ ] 5.2.3 Initialize empty 96-well plate
- [ ] 5.2.4 Mount RunsheetEditor component

### 5.3 Edit Runsheet Page
- [ ] 5.3.1 Create `src/app/(dashboard)/analyst/runsheets/[id]/page.tsx`
- [ ] 5.3.2 Fetch existing runsheet data
- [ ] 5.3.3 Mount RunsheetEditor with data
- [ ] 5.3.4 Handle read-only mode for completed plates

### 5.4 Navigation
- [ ] 5.4.1 Add "Phiếu chạy mẫu" link to analyst sidebar
- [ ] 5.4.2 Add breadcrumbs to runsheet pages

## 6. Vietnamese Translations

- [ ] 6.1 Add runsheet-related terms to `docs/vietnamese_dictionary.md`
  - Runsheet: "Phiếu chạy mẫu"
  - Plate: "Khay 96 giếng"
  - Well: "Giếng"
  - Blank: "Mẫu trắng"
  - Standard: "Mẫu chuẩn"
  - Control: "Mẫu QC"
  - Fill by row: "Điền theo hàng"
  - Fill by column: "Điền theo cột"
  - Exclude: "Loại bỏ"

## 7. Testing & Validation

### 7.1 Manual Testing
- [ ] 7.1.1 Test as Analyst: Create new runsheet
- [ ] 7.1.2 Test as Analyst: Assign samples to wells
- [ ] 7.1.3 Test as Analyst: Change well types
- [ ] 7.1.4 Test as Analyst: Exclude wells
- [ ] 7.1.5 Test as Analyst: Save and reload
- [ ] 7.1.6 Test as Manager: View analyst's runsheets
- [ ] 7.1.7 Verify audit logs capture all changes

### 7.2 Type Checking
- [ ] 7.2.1 Run `npm run typecheck` - no errors
- [ ] 7.2.2 Run `npm run lint` - no errors
- [ ] 7.2.3 Run `npm run build` - successful build

## 8. Documentation

- [ ] 8.1 Update CLAUDE.md if new patterns introduced
- [ ] 8.2 Add usage notes to component files
- [ ] 8.3 Document RPC function parameters in migration file
