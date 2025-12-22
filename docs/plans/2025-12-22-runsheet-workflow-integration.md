# Runsheet Workflow Integration Design

**Date:** 2025-12-22
**Status:** Approved
**Author:** Claude (Brainstorming Session)
**Related:** `openspec/changes/add-96-well-runsheet/design.md`

## Overview

This document captures the design decisions for integrating the 96-well plate runsheet feature into the existing LIMS sample workflow. The design ensures the runsheet is an optional tool that enhances batch processing without disrupting manual entry workflows.

## Current Workflow (Pre-Runsheet)

```
┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌────────┐    ┌───────────┐
│ Received │───▶│ Assigned │───▶│ In Progress │───▶│ Review │───▶│ Completed │
└──────────┘    └──────────┘    └─────────────┘    └────────┘    └───────────┘
```

**Key transitions:**
- `received` → `assigned`: Tests assigned to sample, result records created as `pending`
- `assigned` → `in_progress`: First result value saved
- `in_progress` → `review`: Analyst submits sample for manager review
- `review` → `completed`: Manager approves all results

## Updated Workflow (With Runsheet)

```
                                    ┌─────────────────────────────────────────┐
                                    │         RUNSHEET LIFECYCLE              │
                                    │  draft → running → completed (→ voided) │
                                    └─────────────────────────────────────────┘
                                                      │
                                                      │ "running" triggers:
                                                      │ • Lock well assignments
                                                      │ • Samples → in_progress
                                                      ▼
┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌────────┐    ┌───────────┐
│ Received │───▶│ Assigned │───▶│ In Progress │───▶│ Review │───▶│ Completed │
└──────────┘    └──────────┘    └─────────────┘    └────────┘    └───────────┘
                     │                 ▲                ▲
                     │                 │                │
                     │    ┌────────────┴───┐            │
                     │    │ Two entry paths│            │
                     │    ├────────────────┤            │
                     │    │ A) Runsheet    │────────────┤ Submit from
                     │    │ B) Manual      │            │ plate view
                     └───▶└────────────────┘            │ (partial OK)
```

## Design Decisions Summary

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Runsheet in workflow | Tool within `in_progress` phase | Not all tests need plates (colorimetric, volumetric, etc.) |
| 2 | Result status | Runsheet tracks assignment via FK, result status unchanged | Clean separation: runsheet=physical location, result=data state |
| 3 | Lifecycle triggers | `running` locks plate + transitions samples to `in_progress` | Mirrors physical reality of starting instrument run |
| 4 | Result entry | Plate grid with expandable detail panel | Single-page focused experience |
| 5 | Submission flow | Hybrid - submit selected wells from plate view | Supports partial plate submission |
| 6 | Manager review | Both sample-based queue + plate view toggle | Routine review fast; QC pattern analysis when needed |
| 7 | Rejection workflow | Immutable data; retest creates NEW result with `parent_result_id` | 21 CFR Part 11 compliance |
| 8 | QC wells | Hybrid routing: blanks/standards → plate-only; controls → Westgard | Integrates with existing Westgard QC system |

## Decision Details

### 1. Runsheet as Optional Tool

The runsheet is a tool within the `in_progress` phase, not a mandatory workflow step.

**Two Entry Paths:**
```
Path A: Runsheet-based (plate assays)
  Sample → Assigned → Add to Runsheet → Start Run → Enter on Plate → In Progress

Path B: Manual (non-plate assays)
  Sample → Assigned → Enter Result Manually → In Progress
```

**Why:** Not all assays require plate-based execution. Colorimetric, volumetric, and qualification tests can be entered manually via the existing results page.

### 2. Result Status Unchanged

The runsheet tracks physical well assignment via `runsheet_wells.result_id` foreign key. The result's status (`pending` → `entered` → `approved`) remains independent.

**Why:** Clean separation of concerns. The runsheet answers "where is this result on the plate?" while the result status answers "what is the data state?"

### 3. Runsheet Lifecycle Triggers

When runsheet transitions to `running`:
1. Lock all well assignments (no further changes)
2. Transition all linked samples with status `assigned` to `in_progress`

**SQL Implementation:**
```sql
-- RPC function: start_runsheet_run(runsheet_id)
UPDATE runsheets SET status = 'running', started_at = NOW() WHERE id = $1;

UPDATE samples SET status = 'in_progress'
WHERE id IN (
    SELECT DISTINCT r.sample_id
    FROM runsheet_wells rw
    JOIN results r ON r.id = rw.result_id
    WHERE rw.runsheet_id = $1
)
AND status = 'assigned';
```

### 4. Result Entry on Plate Grid

Primary result entry happens on the plate grid with an expandable detail panel.

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Plate Grid                              │ Detail Panel              │
│ ┌─────────────────────────────────────┐ │ ┌───────────────────────┐ │
│ │ 1   2   3   4   5   6   7   8  ...  │ │ │ Well: A3              │ │
│ │ A  [●] [●] [◉] [ ] [ ] [ ] [ ] ...  │ │ │ Sample: MAU-001       │ │
│ │ B  [ ] [ ] [ ] [ ] [ ] [ ] [ ] ...  │ │ │ Assay: Glucose        │ │
│ │ ...                                 │ │ │ ───────────────────── │ │
│ └─────────────────────────────────────┘ │ │ Value: [_________]    │ │
│                                         │ │ Units: mg/dL          │ │
│ [●] = assigned  [◉] = selected          │ │ Notes: [__________]   │ │
│                                         │ │ [Save] [Next Well]    │ │
│                                         │ └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Partial Plate Submission

Support submitting selected wells from plate view.

**Well States:**
- Ready to submit: `entered` status, can be selected
- Not ready: `pending` status (no value entered)
- Already submitted: grayed out or badge indicator

**Why:** Real-world plates often have some samples ready before others.

### 6. Manager Review Views

Managers have access to both:
- **Sample-based approval queue** (default) - fast routine review
- **Plate-based review view** (toggle) - spot QC patterns, edge effects, drift

### 7. Rejection and Retest Workflow

Original data is immutable (21 CFR Part 11 compliance).

**Schema Addition:**
```sql
ALTER TABLE results ADD COLUMN parent_result_id UUID REFERENCES results(id);
ALTER TABLE results ADD COLUMN retest_reason TEXT;
```

**Flow:**
```
Original Result (status: 'retest_required')
    ↓ rejection_reason: "Out of spec - verify"
    ↓
Retest Result (parent_result_id → original)
    ↓ retest_reason: "Re-analyzed per SOP-123"
    ↓ status: 'entered' → 'approved'
```

### 8. QC Well Routing

Hybrid routing based on well type:

| Well Type | Storage | Westgard Tracking |
|-----------|---------|-------------------|
| Blank | `runsheet_wells` only | No |
| Standard | `runsheet_wells` only | No |
| Control | `runsheet_wells` + `qc_results` | Yes |

**Why:** Blanks/standards are plate-specific (contamination check, calibration curve). Controls using registered QC materials should feed into the longitudinal Westgard IQC system.

## Vietnamese Translations

| English | Vietnamese |
|---------|------------|
| Start Run | Bắt đầu chạy |
| Submit for Review | Gửi duyệt |
| View by Plate | Xem theo khay |
| Approve | Phê duyệt |
| Reject | Từ chối |
| Retest Required | Cần chạy lại |
| Next Well | Giếng tiếp |

## Implementation Notes

1. **Dependency:** QC control routing depends on Westgard QC feature (`add-westgard-qc`)
2. **RLS Policies:** Follow existing pattern - analysts see own, managers see all
3. **Audit Trail:** All status changes and result modifications logged automatically
4. **Optimistic Locking:** Use `version` column on runsheets table

## See Also

- `openspec/changes/add-96-well-runsheet/design.md` - Full technical design
- `openspec/changes/add-96-well-runsheet/specs/runsheet-management/spec.md` - Requirements
- `openspec/changes/add-westgard-qc/design.md` - Westgard QC integration
- `docs/plans/2025-12-21-plate-grid-ui-design.md` - UI component design
