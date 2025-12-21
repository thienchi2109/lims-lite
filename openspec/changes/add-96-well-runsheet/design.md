## Context

This design addresses the need for a 96-well plate runsheet management system in CDC-LIMS. Laboratory technicians physically arrange samples in microplate wells before instrument analysis. The digital system must mirror this workflow while enforcing data integrity and regulatory compliance.

**Design Documents:**
- UI Design: `docs/plans/2025-12-21-plate-grid-ui-design.md`

### Constraints
- Must comply with 21 CFR Part 11 (audit trails, electronic signatures)
- Self-hosted Supabase/PostgreSQL backend
- Vietnamese UI text (per project requirements)
- Integrate with existing sample/result workflow
- Support keyboard navigation for efficiency

### Stakeholders
- **Analysts**: Create runsheets, assign samples, enter results
- **Managers**: Review completed plates, approve results
- **QA/Compliance**: Audit trail verification

## Goals / Non-Goals

### Goals
- Enable visual 8x12 grid mapping of samples to well positions
- Support batch operations (fill by row/column, clear, template application)
- Enforce sample eligibility rules (only assigned/in-progress samples)
- Maintain full audit trail of all plate modifications
- Provide efficient keyboard navigation for data entry
- Support QC sample types (blanks, standards, controls)

### Non-Goals
- Direct instrument integration (future phase)
- Real-time instrument status monitoring
- Multi-plate batch creation (MVP: one plate at a time)
- Automated result import from instruments
- Complex plate templates with conditional logic

## Decisions

### 1. Database Schema Design

**Decision**: Create separate `runsheets` (plate header) and `runsheet_wells` (well assignments) tables with foreign key to `results` table.

**Rationale**:
- Links to existing `results` table preserves sample-result workflow
- One well = one result (specific test on specific sample)
- Separating plate header from wells allows efficient queries
- Soft delete pattern consistent with existing tables

**Alternatives Considered**:
- JSONB array for wells in single row: Rejected - harder to query individual wells, no FK constraints
- Direct link to samples table: Rejected - need to track specific test (result), not just sample

### 2. Well Position Representation

**Decision**: Store both string position ('A1') and integer indices (row_index, col_index).

**Rationale**:
- String position for display and human readability
- Integer indices for efficient sorting and range queries
- Enables "fill by row" vs "fill by column" queries

### 3. UI Component Architecture

**Decision**: Single-page layout with 3-panel design:
1. Sample picker sidebar (left)
2. Plate grid (center)
3. Well detail/legend (right or bottom)

**Rationale**:
- Mirrors existing `test-assignment-grid.tsx` pattern
- Allows drag-and-drop between panels
- Keeps context visible during assignment

**Component Structure**:
```
RunsheetPage (Server Component - data fetch)
└── RunsheetEditor (Client Component - state management)
    ├── SamplePicker (virtualized list, search, filter)
    ├── PlateGrid (8x12 grid)
    │   └── WellCell × 96 (individual wells)
    ├── WellLegend (color coding explanation)
    └── RunsheetToolbar (save, fill, clear, template)
```

### 4. State Management

**Decision**: Local React state with `useReducer`, optimistic updates, Server Actions for persistence.

**Rationale**:
- Consistent with existing codebase patterns
- `useReducer` better for complex state with multiple related updates
- No need for global state library
- Optimistic updates provide responsive UX
- Server Actions handle validation and audit logging

**State Shape** (Finalized from brainstorming):
```typescript
interface PlateEditorState {
  // Grid state
  wells: Map<string, WellState>      // 'A1' -> WellState
  focusedWell: string | null         // Current keyboard focus (roving tabindex)
  selectedWells: string[]            // ARRAY preserves selection order for assignment

  // Picker state
  selectedSamples: EligibleSample[]  // Ordered array from picker
  sampleSearchQuery: string

  // Settings
  fillDirection: 'row' | 'column'    // User toggle, row default

  // UI state
  isDirty: boolean
  isSaving: boolean
}

interface WellState {
  resultId: string | null
  sampleIdDisplay: string | null
  wellType: 'empty' | 'sample' | 'blank' | 'standard' | 'control'
  concentration: number | null       // For standards
  isExcluded: boolean
  exclusionReason: string | null
}

interface EligibleSample {
  resultId: string
  sampleId: string                   // Display ID (e.g., "MAU-001")
  receivedAt: string
}
```

**Reducer Actions**: `SELECT_WELL`, `TOGGLE_WELL`, `RANGE_SELECT`, `ASSIGN_SAMPLES`, `CLEAR_WELLS`, `SET_WELL_TYPE`, `SET_FILL_DIRECTION`

### 5. Sample Eligibility Filter

**Decision**: Only show samples with `status IN ('assigned', 'in_progress')` AND having pending results for selected assay.

**Rationale**:
- Prevents adding samples without assigned tests
- Prevents adding already-completed samples
- Assay filter ensures plate homogeneity

**Query**:
```sql
SELECT DISTINCT s.id, s.sample_id, r.id as result_id
FROM samples s
JOIN results r ON r.sample_id = s.id
WHERE s.status IN ('assigned', 'in_progress')
  AND s.deleted_at IS NULL
  AND r.status = 'pending'
  AND r.assay_id = :selected_assay_id
  AND r.id NOT IN (SELECT result_id FROM runsheet_wells WHERE result_id IS NOT NULL)
ORDER BY s.received_at ASC
```

### 6. Audit Trail Implementation

**Decision**: Use existing trigger-based audit logging pattern from `audit_logs` table.

**Rationale**:
- Consistent with existing compliance approach
- Automatic capture of all changes
- No additional application code needed

**Additional Logging**:
- Dynamic auditing: Log well assignment changes to temporary staging before final save
- Reason field: Require reason when modifying after initial save (21 CFR Part 11)

### 7. Well Selection Interactions

**Decision**: Support multiple selection methods:
1. Single click: Select one well
2. Shift+click: Range select
3. Ctrl+click: Add to selection
4. Click row header (A-H): Select entire row
5. Click column header (1-12): Select entire column
6. Drag selection: Marquee select

**Rationale**:
- Matches familiar spreadsheet interactions
- Enables efficient batch operations
- Reduces clicks for common workflows

### 8. Fill Direction

**Decision**: Support both "by row" (A1→A12→B1) and "by column" (A1→H1→A2) fill patterns with toggle.

**Rationale**:
- Different instruments/protocols prefer different orientations
- Multichannel pipettes work by column typically
- Single-channel filling often by row

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Performance with large sample lists | Use virtualization (`@tanstack/react-virtual`) |
| Drag-drop complexity | Start with click-to-assign, add drag later if needed |
| Mobile usability | Not primary use case; ensure basic functionality works |
| Result ID uniqueness per plate | Add unique constraint on `(runsheet_id, result_id)` |
| Concurrent editing conflicts | Add `updated_at` optimistic locking |

## Migration Plan

### Phase 1: Database Schema
1. Create migration for `runsheets` table
2. Create migration for `runsheet_wells` table
3. Add RLS policies
4. Create RPC functions for batch operations

### Phase 2: Core UI
1. Create plate grid component
2. Create sample picker component
3. Implement basic assignment workflow
4. Add save functionality

### Phase 3: Advanced Features
1. Add fill patterns (by row/column)
2. Add well type selection (blank, standard, control)
3. Add exclusion functionality
4. Add template support

### Phase 4: Integration
1. Link to results entry workflow
2. Add status transitions
3. Add manager review capability

### Rollback
- Drop new tables if critical issues discovered
- No existing data affected (additive feature)

## Open Questions

1. **Template Management**: Should templates be admin-configurable or hardcoded per assay type? → *Defer to Phase 2*

2. **Barcode Integration**: What barcode scanner hardware is available? → *Defer: add keyboard wedge support first*

3. **Plate Numbering**: Auto-generate vs manual entry? → *Propose: Auto-generate with format `PLATE-YYYY-NNNN`*

4. **Result Entry Location**: Enter results on plate grid or separate results page? → *Propose: Plate grid for entry, existing results page for review*

5. **Multi-Assay Plates**: Can one plate contain multiple assay types? → *Propose: No, one assay per plate for MVP simplicity*

---

## UI Design Decisions (Brainstorming Session 2025-12-21)

### Approved Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Grid Rendering | **CSS Grid** | Native, no library needed, 96 fixed wells |
| Selection Model | **Array-based** | Preserves selection order for bidirectional assignment |
| Keyboard Navigation | **Roving tabindex** | WAI-ARIA Grid pattern, Tab exits grid |
| Sample Assignment | **Click-to-assign** | Simple, touch-friendly, batch-efficient, no drag library |
| Color Coding | **Semantic** | Blue(sample)/Green(standard)/Yellow(control)/Red(excluded) |
| Well Content | **Minimal** | Position when empty, color when assigned, tooltip on hover |
| Selection Visual | **Ring outline** | `ring-2 ring-blue-600`, consistent with shadcn/ui |
| Fill Direction | **User toggle** | Row default, column option for multichannel pipettes |

### Bidirectional Assignment Workflow

Users can assign samples in two ways:
1. **Wells First**: Select wells → Select samples → Click "Gán mẫu"
2. **Samples First**: Select samples → Select wells → Click "Gán mẫu"

Both preserve selection order for 1:1 mapping.

### Visual Design

```typescript
const wellStyles = {
  base: 'w-11 h-11 rounded-sm text-xs font-mono flex items-center justify-center cursor-pointer transition-all',

  // Well types (Semantic colors)
  empty:    'bg-gray-100 text-gray-400',
  sample:   'bg-blue-400 text-white',
  blank:    'bg-slate-200 text-slate-600',
  standard: 'bg-green-400 text-white',
  control:  'bg-yellow-400 text-yellow-900',
  excluded: 'bg-red-400 text-white line-through opacity-60',

  // States
  selected: 'ring-2 ring-blue-600',
  focused:  'ring-2 ring-blue-600 ring-offset-2',
}
```

### File Structure

```
src/components/runsheet/
├── plate-grid-editor.tsx      # Main container with state management
├── plate-grid.tsx             # 8x12 CSS grid component
├── well-cell.tsx              # Individual well with interactions
├── sample-picker.tsx          # Left panel with virtualized list
├── plate-toolbar.tsx          # Top action bar
├── well-legend.tsx            # Color coding legend
└── use-plate-keyboard.ts      # Keyboard navigation hook
```

See full UI design: `docs/plans/2025-12-21-plate-grid-ui-design.md`

---

## Backend Architecture (Agent Review 2025-12-21)

### Schema Enhancements

Based on backend architect review, add these columns:

```sql
-- runsheets table additions
version INTEGER NOT NULL DEFAULT 1,        -- Optimistic locking
well_count INTEGER NOT NULL DEFAULT 0,     -- Denormalized for list performance
started_at TIMESTAMPTZ,                    -- Workflow tracking
completed_at TIMESTAMPTZ,

-- runsheet_wells table additions
row_index SMALLINT NOT NULL CHECK (row_index >= 0 AND row_index <= 7),
col_index SMALLINT NOT NULL CHECK (col_index >= 0 AND col_index <= 11),
excluded_by UUID REFERENCES users(id),
excluded_at TIMESTAMPTZ,

-- Constraints
CONSTRAINT valid_position CHECK (position ~ '^[A-H](1[0-2]|[1-9])$'),
CONSTRAINT unique_well_per_plate UNIQUE (runsheet_id, position),
CONSTRAINT unique_result_per_plate UNIQUE (runsheet_id, result_id),
CONSTRAINT exclusion_requires_reason CHECK (
    (is_excluded = FALSE) OR (is_excluded = TRUE AND exclusion_reason IS NOT NULL)
),
```

### RPC Functions Required

1. `assign_wells_to_runsheet(runsheet_id, assignments[], expected_version)` - Batch assign with optimistic locking
2. `clear_runsheet_wells(runsheet_id, positions[], expected_version)` - Batch clear wells
3. `update_runsheet_status(runsheet_id, new_status, reason)` - Workflow transitions
4. `get_eligible_samples_for_runsheet(assay_id, exclude_runsheet_id, limit)` - Sample picker query

### RLS Security Model

| Operation | Analyst | Manager |
|-----------|---------|---------|
| View all runsheets | Yes | Yes |
| Create runsheet | Yes (own) | Yes |
| Edit draft runsheet | Yes (own) | Yes (any) |
| Start/Complete runsheet | Yes (own) | Yes (any) |
| Void runsheet | No | Yes |

### Index Strategy

- `idx_runsheet_wells_runsheet_id` - Load all wells for a plate
- `idx_runsheet_wells_result_id` - Find which plate contains a result
- `idx_runsheets_status_created` - List by status, sorted by date
- `idx_runsheet_wells_position_order` - Grid rendering order
- `idx_runsheet_wells_non_empty` (partial) - Count non-empty wells
