# Add Westgard Quality Control System

## Why

Medical laboratories require robust Internal Quality Control (IQC) to ensure result accuracy and comply with ISO 15189 and 21 CFR Part 11 standards. Currently, lims-lite lacks statistical process control capabilities to monitor test precision and detect systematic/random errors before releasing patient results.

Implementing Westgard Multirules (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10-x) with Levey-Jennings charting will:
- Prevent release of unreliable patient results during instrument malfunction
- Provide automated error detection using Six Sigma metrics
- Ensure compliance with ISO 15189 QC requirements
- Create audit trail for all QC activities per 21 CFR Part 11

## What Changes

- **NEW CAPABILITY:** Complete Westgard QC system with:
  - 4 core database tables: `qc_materials`, `qc_definitions`, `qc_results`, `qc_violations`
  - Real-time Westgard Multirule evaluation engine
  - Automatic patient result blocking during "Out of Control" status
  - Levey-Jennings chart visualization with color-coded violations
  - Six Sigma metrics calculation and automated rule selection
  - QC lot change management (crossover protocol)
  - Initial control limits establishment workflow (20-point collection)

- **Database Schema:**
  - QC material tracking (lot numbers, expiration, levels)
  - Lab-established control limits (Mean, SD per test/instrument)
  - Daily QC measurements with auto-calculated Z-scores
  - Violation tracking with mandatory corrective actions

- **Compliance Features:**
  - Full audit trail for QC data entry, violations, and approvals
  - Electronic signature workflow for QC limit approvals
  - Retrospective patient result review on QC failures
  - RLS policies: Analysts can enter/view, Managers can approve/modify limits

- **User Interface:**
  - Vietnamese-localized QC terminology
  - Interactive Levey-Jennings charts (TanStack Table + Recharts)
  - QC violation resolution workflow with mandatory troubleshooting
  - Dashboard showing real-time QC status per test/instrument

## Impact

### Affected Specs
- **NEW:** `specs/quality-control/spec.md` - Complete Westgard QC capability
- **MODIFIED:** `specs/sample-management/spec.md` - Integration with test result workflows
- **MODIFIED:** `specs/assay-management/spec.md` - QC checks before result release

### Affected Code
- `supabase/migrations/` - 4 new QC tables + RLS policies + triggers
- `src/types/index.ts` - Zod schemas for QC data structures
- `src/app/actions/qc.ts` - Server Actions for QC operations
- `src/components/qc/` - New directory with:
  - `levey-jennings-chart.tsx` - Statistical chart component
  - `qc-entry-form.tsx` - Daily QC data entry
  - `violation-resolution-dialog.tsx` - Corrective action workflow
  - `control-limits-wizard.tsx` - 20-point establishment wizard
  - `lot-changeover-dialog.tsx` - Crossover protocol
- `src/app/(dashboard)/manager/quality-control/` - QC management pages
- `src/app/(dashboard)/analyst/qc-entry/` - Daily QC entry page
- `src/lib/qc/` - New directory with:
  - `westgard-rules.ts` - Rule evaluation engine
  - `sigma-metrics.ts` - Six Sigma calculations
  - `qc-utils.ts` - Helper functions

### Breaking Changes
**None** - This is a net-new capability with no impact on existing features.

### Migration Path
1. Run migration to create 4 QC tables with RLS policies
2. Seed with QC materials and initial definitions (optional)
3. Train users on Westgard QC workflows
4. Establish initial control limits for active tests (20-point protocol)

### Risks
- **Learning curve:** Users need training on Westgard rules interpretation
- **Initial setup:** Each test requires 20-point data collection (10-20 days)
- **Database growth:** QC data accumulates daily (manageable with indexes)

### Dependencies
- Existing `tests` table (foreign key relationship)
- Existing `users` table (audit trail)
- Existing audit logging infrastructure
- TanStack Table v8 (already installed)
- Recharts library (needs installation: `npm install recharts`)

### Testing Requirements
- Unit tests for Westgard rule evaluation logic
- Integration tests for patient result blocking mechanism
- Security tests for RLS policies (analysts cannot modify limits)
- E2E tests for complete QC workflows

### Documentation Requirements
- User guide: Vietnamese QC terminology reference
- SOP: Daily QC entry procedure
- SOP: QC violation troubleshooting
- SOP: Establishing initial control limits
- SOP: QC lot changeover protocol
- Training materials for Six Sigma concepts
