# Proposal: Add 96-Well Plate Runsheet Management

## Why

Laboratory technicians need a digital interface to manage instrument runs using standard 96-well microplate layouts. Currently, sample-to-test assignment exists but there's no way to organize samples into physical plate positions for batch analysis on instruments like ELISA readers, PCR machines, or spectrophotometers. This creates a disconnect between digital sample tracking and actual laboratory workflow.

## What Changes

- **NEW Capability**: `runsheet-management` - Enables creation and management of 96-well plate runsheets
- Add database schema for plate runsheets and well assignments
- Create 8x12 interactive grid UI component mirroring physical microplate layout
- Implement sample assignment workflow (drag-drop, batch fill, template application)
- Add well state visualization (empty, assigned, in-progress, completed, excluded)
- Integrate with existing sample/result workflow (only samples with `status IN ('assigned', 'in_progress')` can be added)
- Support QC sample positioning (blanks, standards, controls)
- Implement audit trail for all plate modifications (21 CFR Part 11 compliance)

## Impact

### Affected Specs
- `sample-management` - Minor integration (samples can now be assigned to plate wells)
- `runsheet-management` - **NEW** capability being added

### Affected Code

#### Database (New Migrations)
- `supabase/migrations/XXX_create_runsheets.sql` - Schema for `runsheets` and `runsheet_wells` tables
- RLS policies for role-based access
- RPC functions for batch well updates

#### Types
- `src/types/index.ts` - New Zod schemas for `Runsheet`, `RunsheetWell`, `WellPosition`

#### Components (New)
- `src/components/runsheet/plate-grid.tsx` - 8x12 interactive well grid
- `src/components/runsheet/well-cell.tsx` - Individual well display/edit component
- `src/components/runsheet/sample-picker.tsx` - Sample selection sidebar
- `src/components/runsheet/runsheet-toolbar.tsx` - Actions (save, fill, clear, template)

#### Pages
- `src/app/(dashboard)/analyst/runsheets/page.tsx` - Runsheet list
- `src/app/(dashboard)/analyst/runsheets/new/page.tsx` - Create new runsheet
- `src/app/(dashboard)/analyst/runsheets/[id]/page.tsx` - Edit runsheet

#### Server Actions
- `src/app/actions/runsheets.ts` - CRUD operations for runsheets

### Breaking Changes
None - this is a new additive feature.

### Database Schema Overview

```
runsheets
├── id (UUID PK)
├── plate_number (TEXT UNIQUE) - e.g., "PLATE-2025-0001"
├── assay_id (FK → assay_definitions)
├── method_id (FK → methods, nullable)
├── created_by (FK → users)
├── status (ENUM: 'draft', 'running', 'completed', 'voided')
├── notes (TEXT)
├── created_at, updated_at, deleted_at

runsheet_wells
├── id (UUID PK)
├── runsheet_id (FK → runsheets ON DELETE CASCADE)
├── position (TEXT) - 'A1' to 'H12'
├── row_index (INT) - 0-7 (A-H)
├── col_index (INT) - 0-11 (1-12)
├── result_id (FK → results, nullable) - Links to specific test result
├── well_type (ENUM: 'sample', 'blank', 'standard', 'control', 'empty')
├── concentration (NUMERIC, nullable) - For standards
├── is_excluded (BOOLEAN) - Mark well as excluded from analysis
├── exclusion_reason (TEXT)
├── created_at, updated_at
```

### UI Layout (Vietnamese)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Tạo phiếu chạy mẫu                                    [Lưu] [Hủy] │
├─────────────────────────────────────────────────────────────────────┤
│ Xét nghiệm: [Dropdown]     Phương pháp: [Dropdown]                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Danh sách mẫu đợi        │         Khay 96 giếng                  │
│  ┌────────────────────┐    │    ┌─────────────────────────────────┐ │
│  │ [Search box]       │    │    │   1   2   3   4  ...  11  12   │ │
│  │ ☐ MAU-001 (Máu)   │    │    │ A [  ][  ][  ][  ] ... [  ][  ] │ │
│  │ ☐ MAU-002 (Nước)  │ ──▶│    │ B [  ][  ][  ][  ] ... [  ][  ] │ │
│  │ ☐ MAU-003 (Phân)  │    │    │ C [  ][  ][  ][  ] ... [  ][  ] │ │
│  │ ...               │    │    │ D [  ][  ][  ][  ] ... [  ][  ] │ │
│  └────────────────────┘    │    │ E [  ][  ][  ][  ] ... [  ][  ] │ │
│                            │    │ F [  ][  ][  ][  ] ... [  ][  ] │ │
│  Chú thích:               │    │ G [  ][  ][  ][  ] ... [  ][  ] │ │
│  ■ Mẫu   ■ Blank          │    │ H [  ][  ][  ][  ] ... [  ][  ] │ │
│  ■ Chuẩn ■ QC             │    └─────────────────────────────────┘ │
│                            │                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Features from Research (NotebookLM)

1. **Template-Based Assignment**: Apply predefined QC layouts (blanks, standards positions)
2. **Drag-and-Fill**: Select wells and auto-fill samples sequentially (by row or column)
3. **Edge Effect Mitigation**: Option to block outer wells for buffer-only
4. **Replicate Support**: Assign same sample to multiple wells (duplicates/triplicates)
5. **Barcode Mode**: Scan tubes to auto-assign to next available well
6. **Dynamic Auditing**: Log changes even before final save (21 CFR Part 11)
7. **Validation Rules**: Block submission if QC requirements not met
