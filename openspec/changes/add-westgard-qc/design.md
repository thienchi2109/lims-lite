# Technical Design - Westgard QC System

## Context

Medical laboratories require Internal Quality Control (IQC) to detect errors before releasing patient results. The Westgard Multirule system is the industry-standard statistical approach for monitoring test precision and accuracy using control samples.

**Background:**
- ISO 15189 mandates QC procedures for all quantitative tests
- 21 CFR Part 11 requires full audit trails and electronic signatures
- lims-lite currently lacks QC capabilities entirely
- Users need Vietnamese-localized UI for laboratory staff in Vietnam

**Constraints:**
- Must work with self-hosted Supabase on Docker
- Must respect existing RLS policy architecture
- Must integrate with existing audit logging
- Must not impact existing sample/result workflows (additive only)
- **No `runs` table exists** - use session-based linking instead
- **Use `assay_definitions`** table (not `tests` which doesn't exist)

**Stakeholders:**
- Laboratory analysts (daily QC entry)
- Laboratory managers (QC oversight, limit approval, mode configuration)
- Quality assurance auditors (compliance verification)

## Goals / Non-Goals

**Goals:**
1. Implement complete Westgard Multirule evaluation (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10-x)
2. Auto-block patient result **approval** during "Out of Control" status
3. Provide Levey-Jennings visualization with color-coded violations
4. Calculate Six Sigma metrics for automated rule selection
5. Full 21 CFR Part 11 compliance (audit trail + electronic signatures)
6. Vietnamese-localized terminology throughout UI
7. **Flexible QC modes** - Manager-configurable per assay (daily/batch/shift/none)

**Non-Goals:**
- External QC (EQA/proficiency testing) - future phase
- Integration with instrument middleware (LIS) - future phase
- Multi-site peer group comparisons - future phase
- Automatic QC scheduling/reminders - future phase
- Custom rule creation beyond standard Westgard - out of scope
- **Instrument tracking** - deferred to post-MVP

## Decisions

### Decision 1: Database-Driven Rule Evaluation (Not Client-Side)

**What:** Westgard rule evaluation happens in PostgreSQL triggers/functions and Server Actions, not in client JavaScript.

**Why:**
- **Security:** Prevents client manipulation of QC pass/fail status
- **Auditability:** All calculations logged server-side
- **Consistency:** Same logic for batch imports and manual entry
- **Performance:** Database indexes optimize historical queries for rules like 4-1s and 10-x

**Alternatives Considered:**
- ❌ Client-side evaluation: Fast but insecure, no audit trail
- ❌ External microservice: Over-engineered for this scope
- ✅ Database triggers + Server Actions: Best balance of security and performance

### Decision 2: Z-Score Auto-Calculation via Trigger

**What:** Z-scores calculated automatically on INSERT via PostgreSQL trigger, not in application code.

**Why:**
- **Data integrity:** Z-score always matches (value - mean) / sd
- **Simplicity:** No manual calculation in Server Actions
- **Performance:** Computed once at insert, not on every query
- **Consistency:** Works for bulk imports and manual entry

**Implementation:**
```sql
CREATE TRIGGER calculate_z_score_trigger
BEFORE INSERT OR UPDATE ON qc_results
FOR EACH ROW EXECUTE FUNCTION calculate_z_score();
```

### Decision 3: Session-Based QC Linking (UPDATED)

**What:** QC results are linked to patient results via `qc_sessions` table, not a `runs` table (which doesn't exist).

**Why:**
- **Schema compatibility:** lims-lite has no `runs` table
- **Flexibility:** Sessions support multiple QC modes (daily, batch, shift)
- **Traceability:** Clear link between QC status and blocked results
- **Manager control:** Each assay can have different QC mode

**Schema:**
```sql
-- New table for QC sessions
CREATE TABLE qc_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assay_id UUID REFERENCES assay_definitions(id) NOT NULL,
  session_mode TEXT DEFAULT 'daily' CHECK (session_mode IN ('daily', 'batch', 'shift')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  qc_status TEXT DEFAULT 'pending' CHECK (qc_status IN ('pending', 'pass', 'warning', 'blocked', 'resolved')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link patient results to QC sessions
ALTER TABLE results ADD COLUMN qc_session_id UUID REFERENCES qc_sessions(id);
```

**QC Modes (Manager-Configurable per Assay):**
| Mode | Description | Blocking Scope |
|------|-------------|----------------|
| `daily` | QC once per day | All results for that assay that day |
| `batch` | QC per batch of samples | Only results in that batch |
| `shift` | QC per work shift | Results within that shift |
| `none` | No Westgard QC | Audit only, no blocking |

### Decision 4: Block at Approval Time (Not Entry)

**What:** When QC fails, patient results can still be **entered** but cannot be **approved** until QC is resolved.

**Why:**
- **Less disruptive:** Analysts can continue entering results while QC issues are resolved
- **Practical workflow:** Lab work doesn't stop completely during QC troubleshooting
- **Manager gating:** Final quality gate is at approval, not entry

**Implementation:**
```typescript
// In approveResults Server Action
async function approveResults(data: ApproveResults) {
  // Check QC session status for each result
  const blockedResults = await checkQCSessionStatus(data.resultIds);
  if (blockedResults.length > 0) {
    return {
      error: 'Không thể phê duyệt. QC đang mất kiểm soát. Vui lòng giải quyết vi phạm QC trước.',
      blockedResults
    };
  }
  // ... proceed with approval
}
```

### Decision 5: RLS Policies Mirror Existing RBAC Pattern

**What:** Analysts can INSERT/SELECT QC data, only Managers can UPDATE `qc_definitions` and resolve violations.

**Why:**
- **Consistency:** Matches existing RLS architecture in lims-lite
- **Security:** Prevents analysts from manipulating control limits
- **Compliance:** Separation of duties for 21 CFR Part 11

**Policies:**
```sql
-- Analysts: Insert QC results
CREATE POLICY "Analysts can insert QC results"
ON qc_results FOR INSERT
WITH CHECK (get_user_role() IN ('analyst', 'manager'));

-- Managers only: Modify control limits
CREATE POLICY "Managers can modify QC definitions"
ON qc_definitions FOR UPDATE
USING (get_user_role() = 'manager');

-- Managers only: Resolve violations
CREATE POLICY "Managers can resolve violations"
ON qc_violations FOR UPDATE
USING (get_user_role() = 'manager');

-- Managers only: Configure QC sessions
CREATE POLICY "Managers can manage QC sessions"
ON qc_sessions FOR ALL
USING (get_user_role() = 'manager');
```

### Decision 6: Recharts for Levey-Jennings Visualization

**What:** Use Recharts library for Levey-Jennings charts instead of custom Canvas/SVG.

**Why:**
- **Proven:** Widely used, battle-tested charting library
- **React-native:** Declarative API fits our component architecture
- **Responsive:** Built-in responsiveness and tooltips
- **Accessible:** Better than custom Canvas implementations

**Alternatives Considered:**
- ❌ Chart.js: Imperative API, harder to integrate with React
- ❌ D3.js: Too low-level, steeper learning curve
- ❌ Custom SVG: Reinventing the wheel, high maintenance
- ✅ Recharts: Best fit for React 19 + TypeScript stack

**Installation:**
```bash
npm install recharts
```

### Decision 7: Vietnamese Terminology in vietnamese_dictionary.md

**What:** All QC terms translated and stored in `docs/vietnamese_dictionary.md` for consistency.

**Why:**
- **Single source of truth:** Prevents translation inconsistencies
- **Reusability:** Other features can reference same terms
- **Maintainability:** Easy to update if terminology evolves

**Example:**
```markdown
| English | Vietnamese |
|---------|------------|
| Quality Control | Kiểm soát chất lượng |
| Control Limits | Giới hạn kiểm soát |
| Out of Control | Ngoài giới hạn kiểm soát |
| QC Session | Phiên QC |
```

### Decision 8: 20-Point Collection Enforced in Application, Not Database

**What:** Wizard guides users through 20-point collection, but database allows activation with fewer points (with warnings).

**Why:**
- **Flexibility:** Emergency scenarios may require temporary limits
- **User experience:** Wizard provides guidance without hard constraints
- **Compliance:** Manager approval step serves as safety gate

**Implementation:**
- Wizard shows progress: "12/20 points collected over 8 days"
- Warning if < 20 points or < 10 days
- Manager must acknowledge warning to approve

### Decision 9: No Instrument Tracking for MVP

**What:** QC applies per-assay only, not per-instrument. Instrument tracking deferred to post-MVP.

**Why:**
- **YAGNI:** Simplifies initial implementation
- **Schema stability:** Avoids modifying `results` table beyond `qc_session_id`
- **Future-ready:** Can add `instrument_id` to `qc_sessions` later

**Future Enhancement:**
```sql
-- Post-MVP: Add instrument tracking
ALTER TABLE qc_sessions ADD COLUMN instrument_id TEXT;
ALTER TABLE results ADD COLUMN instrument_id TEXT;
```

## Architecture

### Data Flow (UPDATED)

```
1. Manager creates/starts QC session for assay (e.g., Glucose, mode: daily)
   ↓
2. Analyst enters QC values for Level 1 and Level 2
   ↓
3. Database: INSERT into qc_results (trigger calculates Z-score)
   ↓
4. Server Action: evaluateWestgardRules(result, history)
   ↓
5a. PASS → Update qc_sessions.qc_status = 'pass'
5b. WARNING → Create qc_violations (status: 'warning'), session stays 'pass'
5c. REJECT → Create qc_violations + Update qc_sessions.qc_status = 'blocked'
   ↓
6. Return result to UI with violation details
   ↓
7. If REJECT: Show violation-resolution-dialog
   ↓
8. Analysts enter patient results (results.qc_session_id = active session)
   ↓
9. Manager tries to approve results:
   - If session.qc_status = 'pass' → Approval ALLOWED
   - If session.qc_status = 'blocked' → Approval BLOCKED with error
   ↓
10. To unblock: Manager resolves violation (corrective action) + new QC passes
    ↓
11. session.qc_status = 'resolved' → Approval now allowed
```

### Database Schema (UPDATED)

```
qc_materials (Materials inventory - lot tracking)
  ├── id UUID PRIMARY KEY
  ├── material_name TEXT NOT NULL
  ├── lot_number TEXT NOT NULL UNIQUE
  ├── level TEXT CHECK (level IN ('Low', 'Normal', 'High'))
  ├── expiration_date DATE
  ├── deleted_at TIMESTAMPTZ (soft delete)
  ├── created_by UUID → users.id
  └── created_at TIMESTAMPTZ

qc_definitions (Control limits per assay/level)
  ├── id UUID PRIMARY KEY
  ├── assay_id UUID → assay_definitions.id (UPDATED: was test_id)
  ├── material_id UUID → qc_materials.id
  ├── mean NUMERIC NOT NULL
  ├── sd NUMERIC NOT NULL
  ├── is_active BOOLEAN DEFAULT true
  ├── active_date DATE
  ├── created_by UUID → users.id
  └── created_at TIMESTAMPTZ

qc_sessions (NEW - links QC to patient results)
  ├── id UUID PRIMARY KEY
  ├── assay_id UUID → assay_definitions.id
  ├── session_mode TEXT DEFAULT 'daily' ('daily', 'batch', 'shift')
  ├── started_at TIMESTAMPTZ DEFAULT NOW()
  ├── ended_at TIMESTAMPTZ
  ├── qc_status TEXT DEFAULT 'pending' ('pending', 'pass', 'warning', 'blocked', 'resolved')
  ├── created_by UUID → users.id
  └── created_at TIMESTAMPTZ

qc_results (Daily measurements)
  ├── id UUID PRIMARY KEY
  ├── definition_id UUID → qc_definitions.id
  ├── session_id UUID → qc_sessions.id (UPDATED: was run_id)
  ├── value NUMERIC NOT NULL
  ├── z_score NUMERIC (auto-calculated via trigger)
  ├── measured_at TIMESTAMPTZ DEFAULT NOW()
  ├── measured_by UUID → users.id
  ├── status TEXT DEFAULT 'pending' ('pass', 'warning', 'reject')
  └── created_at TIMESTAMPTZ

qc_violations (Rule violations)
  ├── id UUID PRIMARY KEY
  ├── result_id UUID → qc_results.id
  ├── rule_violated TEXT NOT NULL ('1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10-x')
  ├── status TEXT NOT NULL ('warning', 'reject')
  ├── corrective_action TEXT (required for resolution)
  ├── resolved_at TIMESTAMPTZ
  ├── resolved_by UUID → users.id
  └── created_at TIMESTAMPTZ

qc_tea_standards (Total Allowable Error config)
  ├── id UUID PRIMARY KEY
  ├── assay_id UUID → assay_definitions.id (UPDATED: was test_id)
  ├── tea_percentage NUMERIC NOT NULL
  ├── source TEXT ('CLIA', 'Ricos', 'Lab-specific')
  ├── created_by UUID → users.id
  └── created_at TIMESTAMPTZ

results (MODIFIED - add session link)
  └── + qc_session_id UUID → qc_sessions.id (nullable)
```

### Component Architecture

```
src/components/qc/
├── qc-entry-form.tsx          # Daily QC entry (Analyst)
├── qc-session-manager.tsx     # Start/end QC sessions (Manager)
├── levey-jennings-chart.tsx   # Recharts visualization
├── violation-resolution-dialog.tsx  # Corrective action (Manager)
├── control-limits-wizard.tsx  # 20-point establishment
├── lot-changeover-dialog.tsx  # Crossover protocol
└── qc-status-indicator.tsx    # Shows session status in result approval

src/lib/qc/
├── westgard-rules.ts  # Rule evaluation engine
├── sigma-metrics.ts   # Six Sigma calculations
└── qc-utils.ts        # Helper functions

src/app/actions/
└── qc.ts  # Server Actions (enterQCResult, resolveViolation, startSession, etc.)
```

## Risks / Trade-offs

### Risk 1: Learning Curve for Westgard Rules
**Risk:** Laboratory staff may not understand statistical concepts like Z-scores and 2-2s rules.

**Mitigation:**
- Provide Vietnamese training documentation (`docs/SIX_SIGMA_TRAINING.md`)
- Add tooltips with rule explanations in UI
- Include visual examples in Levey-Jennings chart
- Conduct user training sessions before rollout

### Risk 2: Initial 20-Point Collection Delays Deployment
**Risk:** Each test requires 10-20 days to establish valid control limits.

**Mitigation:**
- Allow temporary use of manufacturer's ranges (with warnings)
- Prioritize high-volume tests for initial setup
- Phased rollout: Start with 3-5 critical tests
- Wizard guides step-by-step to reduce confusion

### Risk 3: Database Growth from Daily QC Data
**Risk:** qc_results table grows rapidly (multiple tests × multiple levels × daily entries).

**Mitigation:**
- Add indexes on (definition_id, measured_at) for query performance
- Implement data archiving policy (archive data > 2 years to cold storage)
- Use PostgreSQL partitioning if table exceeds 1M rows
- Monitor table size and query performance

**Estimated Growth:**
- 10 tests × 2 levels × 365 days = 7,300 rows/year
- With 100 tests: 73,000 rows/year (manageable)

### Risk 4: False Positives from Overly Strict Rules
**Risk:** Westgard rules may reject valid sessions, delaying patient result approval.

**Mitigation:**
- Use Six Sigma metrics to auto-select appropriate rules
- High-sigma tests (>6) use relaxed rules (1-3s only)
- Low-sigma tests (<4) use full Multirules
- Manager override capability (with audit trail justification)

### Risk 5: Session Management Complexity
**Risk:** Users may be confused by when to start/end QC sessions.

**Mitigation:**
- Auto-create daily sessions at first QC entry of the day
- Clear UI indicators showing active session status
- Training documentation with workflow examples
- Session history visible in Manager dashboard

## Migration Plan

### Phase 1: Database Setup
1. Create migration file `supabase/migrations/XXX_add_westgard_qc.sql`
2. Apply to development database
3. Seed with sample QC materials (Bio-Rad Level 1/2)
4. Run security tests to verify RLS policies

### Phase 2: Core Logic
1. Implement westgard-rules.ts and sigma-metrics.ts
2. Write unit tests (target 90%+ coverage)
3. Implement Server Actions with Zod validation
4. Test rule evaluation with historical data

### Phase 3: UI Components
1. Build qc-entry-form.tsx and levey-jennings-chart.tsx
2. Build control-limits-wizard.tsx
3. Build violation-resolution-dialog.tsx
4. Build qc-session-manager.tsx
5. Integrate Vietnamese translations

### Phase 4: Integration & Testing
1. Create Analyst and Manager pages
2. Integrate with existing result approval workflow (blocking check)
3. E2E testing of complete QC workflows
4. Security testing of RLS policies

### Phase 5: Documentation & Training
1. Write SOPs in Vietnamese
2. Create training materials
3. Conduct user training sessions
4. Deploy to production with monitoring

### Rollback Plan
If critical issues arise post-deployment:
1. **Soft rollback:** Remove QC check from approval workflow (feature flag)
2. **Data rollback:** QC tables are isolated, can be dropped without affecting core LIMS
3. **Hard rollback:** Restore database backup from pre-migration state

**Rollback SQL:**
```sql
-- Emergency disable (soft rollback)
-- Set all sessions to 'pass' to unblock approvals
UPDATE qc_sessions SET qc_status = 'pass' WHERE qc_status = 'blocked';

-- Remove session link from results
ALTER TABLE results DROP COLUMN qc_session_id;

-- Full rollback (hard rollback)
DROP TABLE qc_violations CASCADE;
DROP TABLE qc_results CASCADE;
DROP TABLE qc_sessions CASCADE;
DROP TABLE qc_definitions CASCADE;
DROP TABLE qc_materials CASCADE;
DROP TABLE qc_tea_standards CASCADE;
```

## Performance Considerations

### Query Optimization
- **Indexes:** (definition_id, measured_at) for historical queries
- **Indexes:** (session_id, status) on qc_results for session status checks
- **Indexes:** (assay_id, qc_status) on qc_sessions for approval blocking check
- **Materialized views:** Consider for Six Sigma dashboard (refresh daily)
- **Pagination:** Levey-Jennings chart loads last 90 days by default
- **Caching:** TanStack Query caches QC status per session (5-minute TTL)

### Expected Load
- **Writes:** ~100 QC entries/day (low volume)
- **Reads:** Levey-Jennings chart queries ~1000 rows (fast with indexes)
- **Rule evaluation:** Executes on INSERT (sub-100ms with proper indexing)
- **Approval check:** Single query per approval (sub-10ms with index)

## Security Considerations

### RLS Policy Testing
Must verify:
- ✅ Analysts cannot UPDATE qc_definitions
- ✅ Analysts cannot DELETE qc_results
- ✅ Analysts cannot UPDATE qc_sessions
- ✅ Only Managers can resolve violations
- ✅ Only Managers can start/end QC sessions
- ✅ Electronic signature captured for Manager approvals

**Test Commands:**
```sql
-- Test as analyst
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "analyst-uuid", "role": "analyst"}';
UPDATE qc_definitions SET mean = 100 WHERE id = 'test-id';  -- Should FAIL
UPDATE qc_sessions SET qc_status = 'pass' WHERE id = 'session-id';  -- Should FAIL
```

### Audit Trail Requirements (21 CFR Part 11)
Every mutation must log:
- `who`: user_id from auth.uid()
- `what`: Action (insert_qc_result, resolve_violation, approve_limits, start_session)
- `when`: TIMESTAMPTZ DEFAULT NOW()
- `why`: Reason (for corrective actions and limit changes)

**Implementation:**
Use existing `audit_logs` table infrastructure with `record_type = 'qc_result'`, `'qc_session'`, `'qc_violation'`.

## Open Questions (RESOLVED)

1. **Q:** Should we support custom Westgard rule combinations beyond the standard 6 rules?
   **A:** No - stick to standard rules for simplicity. Advanced users can request via feature request.

2. **Q:** Should Six Sigma calculations use lab-specific TEa or standard CLIA/Ricos values?
   **A:** Start with CLIA/Ricos standards in `qc_tea_standards` table. Allow Manager override for lab-specific TEa in future.

3. **Q:** Should QC violations automatically send email notifications to managers?
   **A:** Not in MVP. Add notification system in future phase.

4. **Q:** Should we integrate with Supabase Realtime for live QC status updates?
   **A:** Not in MVP. Current polling with TanStack Query (5-min refresh) is sufficient.

5. **Q:** Should we support multiple QC materials per test (e.g., Level 1, Level 2, Level 3)?
   **A:** Yes - `qc_materials.level` field supports 'Low', 'Normal', 'High'. Each gets separate `qc_definitions` entry.

6. **Q:** How should QC link to patient results without a `runs` table?
   **A:** Use `qc_sessions` table. Patient results link via `results.qc_session_id`. Session-based approach supports flexible QC modes.

7. **Q:** Should we track instruments?
   **A:** Not in MVP. QC applies per-assay only. Add instrument tracking post-MVP if needed.

8. **Q:** When should patient results be blocked - at entry or approval?
   **A:** At approval time. Analysts can enter results; managers cannot approve until QC passes.

9. **Q:** Should QC mode be fixed or configurable?
   **A:** Manager-configurable per assay. Supports daily, batch, shift, or none modes.

---

**Decision Authority:** This design requires approval from:
- Project Lead (architecture decisions)
- Laboratory Manager (workflow validation)
- QA/Compliance Officer (21 CFR Part 11 compliance verification)

---

**Last Updated:** 2025-12-31
**Validated With:** User brainstorming session - confirmed session-based linking, flexible modes, block at approval, full multi-level with lot tracking.
