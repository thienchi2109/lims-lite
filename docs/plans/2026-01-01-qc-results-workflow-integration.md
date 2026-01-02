# QC-Results Workflow Integration Plan

## Overview

Integrate QC validation into the patient results entry workflow using a "soft enforcement" approach. QC status is displayed prominently but does not block entry; blocking occurs at approval stage.

**Created:** 2026-01-01
**Status:** Planning
**Approach:** Option A - Soft Enforcement

## Problem Statement

Current state has critical gaps:
1. `results.qc_session_id` column exists but is never populated
2. QC Entry page (`/analyst/qc-entry`) exists but has no navigation link
3. No QC status visibility during result entry
4. Approval-time check exists but always passes (NULL qc_session_id = allow)

## Research Summary

### Industry Standards (ISO 15189, CLIA, CAP)

| Requirement | Description |
|-------------|-------------|
| QC Before Patient Testing | QC must be run at start of shift before patient samples |
| Batch Validation | QC validates entire "analytical run" of patient results |
| Rejection Rules | Westgard 1₃ₛ, 2₂ₛ, R₄ₛ require rejecting patient results |
| Corrective Action | Failed QC requires documented corrective action |
| Audit Trail | All QC and result actions must be logged |

### UX Best Practices

| Pattern | Recommendation |
|---------|----------------|
| Visual Indicators | Traffic light (🟢🟡🔴) for immediate status recognition |
| Blocking Mechanism | Disabled fields preferred over modal popups |
| Single Page Flow | QC + Results on same screen, no redirects |
| State-Based Interlock | Lock result entry until QC validates |

## Architecture Decision

### Current Result Entry Points

```
1. /analyst/results/[sampleId]     → Separate full page (TO BE DEPRECATED)
2. /analyst/samples                → AssignedTestsPanel inline (PRIMARY)
   └── AssignedTestsPanel
       ├── ResultCellEditor        → Inline result editing
       ├── BatchSaveToolbar        → Save results
       └── useResultsEditor hook   → State management
```

### Chosen Approach: Unified Samples Page

Focus all result entry on `AssignedTestsPanel` within `/analyst/samples`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Samples Page (/analyst/samples)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────────────────────────────────┐  │
│  │ Sample List      │  │ AssignedTestsPanel                         │  │
│  │                  │  │ ┌────────────────────────────────────────┐ │  │
│  │ • ABC-001 ✓      │  │ │ QC Status Banner                       │ │  │
│  │ • ABC-002 →      │  │ │ 🟢 Glucose: Pass | 🔴 HbA1c: Cần QC    │ │  │
│  │ • ABC-003        │  │ │ [Nhập QC nhanh →]                      │ │  │
│  │                  │  │ └────────────────────────────────────────┘ │  │
│  │                  │  │                                            │  │
│  │                  │  │ ┌────────────────────────────────────────┐ │  │
│  │                  │  │ │ Results Table                          │ │  │
│  │                  │  │ │  Assay   | Value | Status | QC         │ │  │
│  │                  │  │ │  Glucose | 5.6   | ✓      | 🟢         │ │  │
│  │                  │  │ │  HbA1c   | [___] | pending| 🔴 warn    │ │  │
│  │                  │  │ └────────────────────────────────────────┘ │  │
│  │                  │  │                                            │  │
│  │                  │  │ [Lưu kết quả] [Gửi duyệt]                  │  │
│  └──────────────────┘  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Tasks

### Phase 1: QC Visibility (P1)

#### ~~Task 1: QC Status Banner~~ - SKIPPED
**Decision:** User chose Option A (per-row indicators only).
- Banner would add ~60-80px vertical space and crowd the panel
- Existing IQC button in toolbar is sufficient for navigation to QC entry
- QC entry remains on separate `/analyst/qc-entry` page

#### Task 2: QC Indicator Per Row
**Beads ID:** `lims-lite-4sug`
**Effort:** Small

Add QC status indicator to each row in the results table:
- Small colored dot next to assay name
- Tooltip showing QC details (last run, z-score, etc.)
- Warning icon if QC not done

**Files to modify:**
- `src/components/assigned-tests-panel.tsx` (table rendering)
- Or create `src/components/qc/qc-row-indicator.tsx`

### Phase 2: Data Linking (P2)

#### Task 3: Auto-link qc_session_id
**Beads ID:** `lims-lite-zv8d`
**Effort:** Medium

When saving results via `useResultsEditor`, automatically:
1. Look up active QC session for each assay
2. Set `qc_session_id` on the result record
3. This enables approval-time blocking

**Files to modify:**
- `src/app/actions/results.ts` - `saveBatchResults()`
- Or `src/hooks/use-results-editor.ts`

**Database function needed:**
```sql
CREATE OR REPLACE FUNCTION get_active_qc_session(p_assay_id UUID)
RETURNS UUID AS $$
  SELECT id FROM qc_sessions
  WHERE assay_id = p_assay_id
    AND ended_at IS NULL
    AND qc_status IN ('pass', 'warning', 'resolved')
  ORDER BY started_at DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;
```

### Phase 3: Cleanup (P3)

#### Task 4: Deprecate Separate Results Page
**Beads ID:** `lims-lite-ffgl`
**Effort:** Small

Either:
- Redirect `/analyst/results/[sampleId]` → `/analyst/samples?sampleId=[id]`
- Or remove the page entirely

**Files to modify:**
- `src/app/(dashboard)/analyst/results/[sampleId]/page.tsx`

## QC Status Logic

### Status Determination per Assay

```typescript
interface AssayQCStatus {
  assay_id: string
  assay_name: string
  status: 'pass' | 'warning' | 'blocked' | 'pending' | 'no_session'
  last_qc_at: string | null
  session_id: string | null
  message: string
}

function determineQCStatus(session: QCSession | null): AssayQCStatus['status'] {
  if (!session) return 'no_session'  // No QC session for this assay
  if (session.ended_at) return 'no_session'  // Session ended

  switch (session.qc_status) {
    case 'pass': return 'pass'
    case 'resolved': return 'pass'
    case 'warning': return 'warning'
    case 'blocked': return 'blocked'
    case 'pending': return 'pending'
    default: return 'no_session'
  }
}
```

### Visual Indicators

| Status | Color | Icon | Message |
|--------|-------|------|---------|
| `pass` | 🟢 Green | ✓ | "QC đạt" |
| `warning` | 🟡 Yellow | ⚠ | "QC có cảnh báo" |
| `blocked` | 🔴 Red | ✕ | "QC thất bại - cần hành động" |
| `pending` | 🔴 Red | ○ | "Chưa nhập QC" |
| `no_session` | ⚪ Gray | - | "Chưa có phiên QC" |

## Server Action: Get QC Status for Assays

```typescript
// src/app/actions/qc-status.ts
'use server'

export async function getQCStatusForAssays(assayIds: string[]): Promise<AssayQCStatus[]> {
  const supabase = await createClient()

  // Get active sessions for each assay
  const { data: sessions } = await supabase
    .from('qc_sessions')
    .select(`
      id,
      assay_id,
      qc_status,
      started_at,
      ended_at,
      assay:assay_definitions(id, name)
    `)
    .in('assay_id', assayIds)
    .is('ended_at', null)
    .order('started_at', { ascending: false })

  // Map to status per assay
  return assayIds.map(assayId => {
    const session = sessions?.find(s => s.assay_id === assayId)
    return {
      assay_id: assayId,
      assay_name: session?.assay?.name ?? '',
      status: determineQCStatus(session),
      last_qc_at: session?.started_at ?? null,
      session_id: session?.id ?? null,
      message: getStatusMessage(session)
    }
  })
}
```

## Testing Checklist

- [ ] QC status banner shows correct status per assay
- [ ] Traffic light colors display correctly
- [ ] Clicking "Nhập QC nhanh" opens QC entry
- [ ] Per-row QC indicator matches banner status
- [ ] Saving results populates qc_session_id
- [ ] Results with blocked QC session cannot be approved
- [ ] Results with NULL qc_session_id (pre-QC era) can be approved
- [ ] Audit trail records QC session linkage

## Vietnamese Labels

| English | Vietnamese |
|---------|------------|
| QC Status | Trạng thái QC |
| QC Pass | QC đạt |
| QC Warning | QC có cảnh báo |
| QC Failed | QC thất bại |
| QC Pending | Chưa nhập QC |
| No QC Session | Chưa có phiên QC |
| Quick QC Entry | Nhập QC nhanh |
| Enter QC first | Cần nhập QC trước |

## Future Enhancements (Option B - Hard Enforcement)

If soft enforcement is insufficient, upgrade to hard enforcement:
1. Disable result entry fields when QC blocked/pending
2. Require corrective action workflow for failed QC
3. Add QC re-run tracking with audit
4. Implement "Daily Run" unified workflow page

## References

- [ISO 15189:2022 Quality Management](https://www.iso.org/standard/76677.html)
- [CLSI QC Guidelines](https://clsi.org/standards/)
- [Westgard Rules](https://www.westgard.com/westgard-rules/)
- NotebookLM Research: CDC-LIMS Quality Control notebook
