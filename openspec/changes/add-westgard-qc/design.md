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

**Stakeholders:**
- Laboratory analysts (daily QC entry)
- Laboratory managers (QC oversight, limit approval)
- Quality assurance auditors (compliance verification)

## Goals / Non-Goals

**Goals:**
1. Implement complete Westgard Multirule evaluation (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10-x)
2. Auto-block patient results during "Out of Control" status
3. Provide Levey-Jennings visualization with color-coded violations
4. Calculate Six Sigma metrics for automated rule selection
5. Full 21 CFR Part 11 compliance (audit trail + electronic signatures)
6. Vietnamese-localized terminology throughout UI

**Non-Goals:**
- External QC (EQA/proficiency testing) - future phase
- Integration with instrument middleware (LIS) - future phase
- Multi-site peer group comparisons - future phase
- Automatic QC scheduling/reminders - future phase
- Custom rule creation beyond standard Westgard - out of scope

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

### Decision 3: Patient Result Blocking via Run Status

**What:** When QC violates reject rules, set `run.qc_status = 'blocked'` to prevent result release.

**Why:**
- **Compliance:** ISO 15189 requires blocking unreliable results
- **Traceability:** Clear link between QC failure and blocked results
- **Workflow integration:** Existing result approval checks `run.qc_status`

**Schema:**
```sql
ALTER TABLE runs ADD COLUMN qc_status TEXT DEFAULT 'pending';
-- 'pending', 'pass', 'blocked', 'resolved'
```

### Decision 4: RLS Policies Mirror Existing RBAC Pattern

**What:** Analysts can INSERT/SELECT QC data, only Managers can UPDATE `qc_definitions`.

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
```

### Decision 5: Recharts for Levey-Jennings Visualization

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

### Decision 6: Vietnamese Terminology in vietnamese_dictionary.md

**What:** All QC terms translated and stored in `docs/vietnamese_dictionary.md` for consistency.

**Why:**
- **Single source of truth:** Prevents translation inconsistencies
- **Reusability:** Other features can reference same terms
- **Maintainability:** Easy to update if terminology evolves

**Example:**
```markdown
| English | Vietnamese |
|---------|-----------|
| Quality Control | Kiểm soát chất lượng |
| Control Limits | Giới hạn kiểm soát |
| Out of Control | Ngoài giới hạn kiểm soát |
```

### Decision 7: 20-Point Collection Enforced in Application, Not Database

**What:** Wizard guides users through 20-point collection, but database allows activation with fewer points (with warnings).

**Why:**
- **Flexibility:** Emergency scenarios may require temporary limits
- **User experience:** Wizard provides guidance without hard constraints
- **Compliance:** Manager approval step serves as safety gate

**Implementation:**
- Wizard shows progress: "12/20 points collected over 8 days"
- Warning if < 20 points or < 10 days
- Manager must acknowledge warning to approve

## Architecture

### Data Flow

```
1. Analyst enters QC value
   ↓
2. Server Action: enterQCResult()
   ↓
3. Database: INSERT into qc_results (trigger calculates Z-score)
   ↓
4. Server Action: evaluateWestgardRules(result, history)
   ↓
5a. PASS → Update run.qc_status = 'pass'
5b. WARNING → Create qc_violations (status: 'warning')
5c. REJECT → Create qc_violations + blockPatientResults(runId)
   ↓
6. Return result to UI with violation details
   ↓
7. If REJECT: Show violation-resolution-dialog
```

### Database Schema

```
qc_materials (Materials inventory)
  ├── id, material_name, lot_number, level, expiration_date
  └── created_by → users.id

qc_definitions (Control limits per test/instrument)
  ├── id, test_id → tests.id, instrument_id
  ├── material_id → qc_materials.id
  ├── mean, sd, active_date
  └── created_by → users.id

qc_results (Daily measurements)
  ├── id, definition_id → qc_definitions.id
  ├── run_id, value, z_score (auto-calculated)
  ├── measured_at, measured_by → users.id
  └── status ('pass', 'warning', 'reject')

qc_violations (Rule violations)
  ├── id, result_id → qc_results.id
  ├── rule_violated ('1-3s', '2-2s', etc.)
  ├── status ('warning', 'reject')
  ├── corrective_action (required for 'reject')
  └── resolved_by → users.id

qc_tea_standards (Total Allowable Error config)
  ├── test_id → tests.id
  ├── tea_percentage, source ('CLIA', 'Ricos', etc.)
  └── created_by → users.id
```

### Component Architecture

```
src/components/qc/
├── qc-entry-form.tsx          # Daily QC entry (Analyst)
├── levey-jennings-chart.tsx   # Recharts visualization
├── violation-resolution-dialog.tsx  # Corrective action (Manager)
├── control-limits-wizard.tsx  # 20-point establishment
└── lot-changeover-dialog.tsx  # Crossover protocol

src/lib/qc/
├── westgard-rules.ts  # Rule evaluation engine
├── sigma-metrics.ts   # Six Sigma calculations
└── qc-utils.ts        # Helper functions

src/app/actions/
└── qc.ts  # Server Actions (enterQCResult, resolveViolation, etc.)
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
**Risk:** Westgard rules may reject valid runs, delaying patient result release.

**Mitigation:**
- Use Six Sigma metrics to auto-select appropriate rules
- High-sigma tests (>6) use relaxed rules (1-3s only)
- Low-sigma tests (<4) use full Multirules
- Manager override capability (with audit trail justification)

## Migration Plan

### Phase 1: Database Setup (Week 1)
1. Create migration file `supabase/migrations/XXX_add_westgard_qc.sql`
2. Apply to development database
3. Seed with sample QC materials (Bio-Rad Level 1/2)
4. Run security tests to verify RLS policies

### Phase 2: Core Logic (Week 2)
1. Implement westgard-rules.ts and sigma-metrics.ts
2. Write unit tests (target 90%+ coverage)
3. Implement Server Actions with Zod validation
4. Test rule evaluation with historical data

### Phase 3: UI Components (Week 3-4)
1. Build qc-entry-form.tsx and levey-jennings-chart.tsx
2. Build control-limits-wizard.tsx
3. Build violation-resolution-dialog.tsx
4. Integrate Vietnamese translations

### Phase 4: Integration & Testing (Week 5)
1. Create Analyst and Manager pages
2. Integrate with existing result approval workflow
3. E2E testing of complete QC workflows
4. Security testing of RLS policies

### Phase 5: Documentation & Training (Week 6)
1. Write SOPs in Vietnamese
2. Create training materials
3. Conduct user training sessions
4. Deploy to production with monitoring

### Rollback Plan
If critical issues arise post-deployment:
1. **Soft rollback:** Disable QC checks in result approval workflow (feature flag)
2. **Data rollback:** QC tables are isolated, can be dropped without affecting core LIMS
3. **Hard rollback:** Restore database backup from pre-migration state

**Rollback SQL:**
```sql
-- Emergency disable (soft rollback)
ALTER TABLE runs ALTER COLUMN qc_status SET DEFAULT 'pass';

-- Full rollback (hard rollback)
DROP TABLE qc_violations CASCADE;
DROP TABLE qc_results CASCADE;
DROP TABLE qc_definitions CASCADE;
DROP TABLE qc_materials CASCADE;
DROP TABLE qc_tea_standards CASCADE;
```

## Performance Considerations

### Query Optimization
- **Indexes:** (definition_id, measured_at) for historical queries
- **Materialized views:** Consider for Six Sigma dashboard (refresh daily)
- **Pagination:** Levey-Jennings chart loads last 90 days by default
- **Caching:** TanStack Query caches QC status per test (5-minute TTL)

### Expected Load
- **Writes:** ~100 QC entries/day (low volume)
- **Reads:** Levey-Jennings chart queries ~1000 rows (fast with indexes)
- **Rule evaluation:** Executes on INSERT (sub-100ms with proper indexing)

## Security Considerations

### RLS Policy Testing
Must verify:
- ✅ Analysts cannot UPDATE qc_definitions
- ✅ Analysts cannot DELETE qc_results
- ✅ Only Managers can resolve violations
- ✅ Electronic signature captured for Manager approvals

**Test Commands:**
```sql
-- Test as analyst
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "analyst-uuid", "role": "analyst"}';
UPDATE qc_definitions SET mean = 100 WHERE id = 'test-id';  -- Should FAIL
```

### Audit Trail Requirements (21 CFR Part 11)
Every mutation must log:
- `who`: user_id from auth.uid()
- `what`: Action (insert_qc_result, resolve_violation, approve_limits)
- `when`: TIMESTAMPTZ DEFAULT NOW()
- `why`: Reason (for corrective actions and limit changes)

**Implementation:**
Use existing `audit_logs` table infrastructure with `record_type = 'qc_result'`.

## Open Questions

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

---

**Decision Authority:** This design requires approval from:
- Project Lead (architecture decisions)
- Laboratory Manager (workflow validation)
- QA/Compliance Officer (21 CFR Part 11 compliance verification)
