# Implementation Tasks - Westgard QC System

## 1. Database Schema & Migration
- [ ] 1.1 Create `qc_materials` table with soft delete
- [ ] 1.2 Create `qc_definitions` table with `assay_id` (NOT test_id) and active_date tracking
- [ ] 1.3 Create `qc_sessions` table for session-based QC linking (NEW)
- [ ] 1.4 Create `qc_results` table with `session_id` and z_score auto-calculation trigger
- [ ] 1.5 Create `qc_violations` table with corrective action requirements
- [ ] 1.6 Create `qc_tea_standards` table with `assay_id` for TEa configuration
- [ ] 1.7 Add `qc_session_id` column to `results` table (nullable, NO BACKFILL - NULL = pre-QC era)
- [ ] 1.8 Add RLS policies for Analyst role (INSERT, SELECT on qc_results only)
- [ ] 1.9 Add RLS policies for Manager role (full access to definitions, sessions, violations)
- [ ] 1.10 Create database trigger for auto Z-score calculation on INSERT
- [ ] 1.11 Create indexes on qc_results (definition_id, session_id, measured_at)
- [ ] 1.12 Create indexes on qc_sessions (assay_id, qc_status) for approval blocking check
- [ ] 1.13 Add foreign key constraints to `assay_definitions` table (NOT tests - doesn't exist)
- [ ] 1.14 Test migration with sample data
- [ ] 1.15 Run security tests: `docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"`

**Note:** No backfill required for `results.qc_session_id`. NULL values mean "pre-QC era" and approval is allowed.

## 2. Type Definitions & Schemas
- [ ] 2.1 Define Zod schemas for qc_materials in src/types/index.ts
- [ ] 2.2 Define Zod schemas for qc_definitions with assay_id validation
- [ ] 2.3 Define Zod schemas for qc_sessions with session_mode enum (NEW)
- [ ] 2.4 Define Zod schemas for qc_results with session_id and Z-score
- [ ] 2.5 Define Zod schemas for qc_violations with corrective action
- [ ] 2.6 Define TypeScript types for Westgard rule names ('1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10-x')
- [ ] 2.7 Define TypeScript types for QC status enums ('pending', 'pass', 'warning', 'blocked', 'resolved')
- [ ] 2.8 Define TypeScript types for session modes ('daily', 'batch', 'shift', 'none')
- [ ] 2.9 Export all QC types and schemas

## 3. Westgard Rule Evaluation Engine
- [ ] 3.1 Create src/lib/qc/westgard-rules.ts
- [ ] 3.2 Implement calculateZScore(value, mean, sd) function
- [ ] 3.3 Implement check1_2s(zScore) - Warning rule
- [ ] 3.4 Implement check1_3s(zScore) - Random error
- [ ] 3.5 Implement check2_2s_withinRun(level1Z, level2Z) - Systematic error
- [ ] 3.6 Implement check2_2s_acrossRun(currentZ, previousZ) - Systematic error
- [ ] 3.7 Implement checkR_4s(level1Z, level2Z) - Within-run range
- [ ] 3.8 Implement check4_1s(last4Results) - Trend detection
- [ ] 3.9 Implement check10_x(last10Results) - Systematic shift
- [ ] 3.10 Create evaluateWestgardRules(qcResult, history) orchestrator
- [ ] 3.11 Add unit tests for each rule with edge cases

## 4. Six Sigma Metrics
- [ ] 4.1 Create src/lib/qc/sigma-metrics.ts
- [ ] 4.2 Implement calculateBias(labMean, peerGroupMean) function
- [ ] 4.3 Implement calculateCV(sd, mean) function
- [ ] 4.4 Implement calculateSigma(tea, bias, cv) function
- [ ] 4.5 Implement selectWestgardRules(sigma) - Auto rule selection
- [ ] 4.6 Add unit tests for sigma calculations

## 5. Server Actions
- [ ] 5.1 Create src/app/actions/qc.ts
- [ ] 5.2 Implement createQCMaterial(formData) - Add new material
- [ ] 5.3 Implement createQCDefinition(formData) - Set control limits with assay_id
- [ ] 5.4 Implement startQCSession(assayId, mode) - Start new QC session (NEW)
- [ ] 5.5 Implement endQCSession(sessionId) - End active session (NEW)
- [ ] 5.6 Implement enterQCResult(formData) - Daily entry with rule evaluation, links to active session
- [ ] 5.7 Implement resolveViolation(violationId, correctiveAction) - Manager action
- [ ] 5.8 Implement checkQCSessionStatus(resultIds) - Check if results can be approved (NEW)
- [ ] 5.9 Integrate QC check into approveResults() - Block approval if session.qc_status = 'blocked' (NEW)
- [ ] 5.10 Implement getQCHistory(definitionId, days) - Chart data
- [ ] 5.11 Implement getActiveSession(assayId) - Get current active session (NEW)
- [ ] 5.12 Implement getLotChangeoverData(materialId) - Crossover protocol
- [ ] 5.13 Add Zod validation to all Server Actions
- [ ] 5.14 Add audit logging to all mutations

## 6. Database Helper Functions
- [ ] 6.1 Create PostgreSQL function for Z-score calculation trigger
- [ ] 6.2 Create PostgreSQL function to get active QC session for an assay
- [ ] 6.3 Create PostgreSQL function to check if results can be approved (session status check)
- [ ] 6.4 Grant EXECUTE permissions to authenticated role

## 7. UI Components - QC Entry
- [ ] 7.1 Create src/components/qc/qc-entry-form.tsx
- [ ] 7.2 Add form fields: assay selection, material/level, value, active session indicator
- [ ] 7.3 Integrate react-hook-form with Zod validation
- [ ] 7.4 Display real-time Z-score calculation
- [ ] 7.5 Show immediate rule violation alerts
- [ ] 7.6 Add Vietnamese labels and error messages
- [ ] 7.7 Test form submission and error handling

## 8. UI Components - Session Manager (NEW)
- [ ] 8.1 Create src/components/qc/qc-session-manager.tsx
- [ ] 8.2 Display active sessions per assay with status indicator
- [ ] 8.3 Add "Start Session" button with mode selection (daily/batch/shift)
- [ ] 8.4 Add "End Session" button for active sessions
- [ ] 8.5 Show session history with filtering
- [ ] 8.6 Add Vietnamese labels

## 9. UI Components - Levey-Jennings Chart
- [ ] 9.1 Create src/components/qc/levey-jennings-chart.tsx
- [ ] 9.2 Install recharts: npm install recharts
- [ ] 9.3 Implement chart with Mean ± 1SD, 2SD, 3SD reference lines
- [ ] 9.4 Color-code data points: Green (pass), Yellow (1-2s), Red (reject)
- [ ] 9.5 Add tooltips showing value, Z-score, rule violations
- [ ] 9.6 Add date range filter
- [ ] 9.7 Add export to PDF functionality
- [ ] 9.8 Ensure responsive design for mobile/tablet

## 10. UI Components - Violation Resolution
- [ ] 10.1 Create src/components/qc/violation-resolution-dialog.tsx
- [ ] 10.2 Display violation details (rule violated, timestamp, value)
- [ ] 10.3 Add corrective action text area (required field)
- [ ] 10.4 Add troubleshooting guidance checklist
- [ ] 10.5 Implement electronic signature for Manager approval
- [ ] 10.6 Block dialog closure until corrective action entered
- [ ] 10.7 Add Vietnamese labels

## 11. UI Components - Control Limits Wizard
- [ ] 11.1 Create src/components/qc/control-limits-wizard.tsx
- [ ] 11.2 Add step 1: Select test and QC material
- [ ] 11.3 Add step 2: Enter 20 initial data points
- [ ] 11.4 Add step 3: Calculate Mean and SD
- [ ] 11.5 Add step 4: Review and approve limits (Manager only)
- [ ] 11.6 Display progress indicator (X/20 points collected)
- [ ] 11.7 Validate minimum 20 points over 10+ days
- [ ] 11.8 Add Vietnamese instructions

## 12. UI Components - Lot Changeover
- [ ] 12.1 Create src/components/qc/lot-changeover-dialog.tsx
- [ ] 12.2 Display old lot vs new lot comparison table
- [ ] 12.3 Track crossover data points (minimum 10 required)
- [ ] 12.4 Calculate new Mean and copy CV% from old lot
- [ ] 12.5 Add patient sample comparison workflow
- [ ] 12.6 Require Manager approval for new limits
- [ ] 12.7 Add Vietnamese labels

## 13. UI Components - QC Status Indicator (NEW)
- [ ] 13.1 Create src/components/qc/qc-status-indicator.tsx
- [ ] 13.2 Display QC session status in result approval dialog
- [ ] 13.3 Show warning/error when session is blocked
- [ ] 13.4 Link to violation resolution for blocked sessions
- [ ] 13.5 Add Vietnamese labels

## 14. Pages - Analyst QC Entry
- [ ] 14.1 Create src/app/(dashboard)/analyst/qc-entry/page.tsx
- [ ] 14.2 Display list of assays requiring daily QC with active session status
- [ ] 14.3 Show current QC status per assay (Pass/Warning/Blocked)
- [ ] 14.4 Integrate qc-entry-form component
- [ ] 14.5 Display mini Levey-Jennings chart for last 30 days
- [ ] 14.6 Add Vietnamese page title and instructions

## 15. Pages - Manager QC Management
- [ ] 15.1 Create src/app/(dashboard)/manager/quality-control/page.tsx
- [ ] 15.2 Display all QC materials and definitions table
- [ ] 15.3 Add QC session manager component
- [ ] 15.4 Add "Establish New Limits" button → control-limits-wizard
- [ ] 15.5 Add "Lot Changeover" button → lot-changeover-dialog
- [ ] 15.6 Display pending violations requiring resolution
- [ ] 15.7 Add comprehensive Levey-Jennings chart with filters
- [ ] 15.8 Add Six Sigma metrics dashboard
- [ ] 15.9 Add Vietnamese page title and labels

## 16. Integration - Result Approval (NEW)
- [ ] 16.1 Update src/app/actions/results.ts approveResults() to check QC session status
- [ ] 16.2 Add QC status indicator to approval-dialog.tsx
- [ ] 16.3 Handle NULL qc_session_id as "pre-QC era" - allow approval
- [ ] 16.4 Display blocking error with link to violation resolution
- [ ] 16.5 Test approval blocking with various session states

## 17. Vietnamese Localization
- [ ] 17.1 Add QC terminology to docs/vietnamese_dictionary.md:
  - Kiểm soát chất lượng (Quality Control)
  - Giới hạn kiểm soát (Control Limits)
  - Giá trị trung bình (Mean)
  - Độ lệch chuẩn (Standard Deviation)
  - Biểu đồ Levey-Jennings (Levey-Jennings Chart)
  - Quy tắc Westgard (Westgard Rules)
  - Sai số hệ thống (Systematic Error)
  - Sai số ngẫu nhiên (Random Error)
  - Hành động khắc phục (Corrective Action)
  - Mất kiểm soát (Out of Control)
  - Hệ số biến thiên (Coefficient of Variation)
  - Chỉ số Sigma (Sigma Metrics)
  - Tổng sai số cho phép (Total Allowable Error)
  - Độ chệch (Bias)
  - Độ chụm (Precision)
  - Độ đúng (Accuracy)
  - Số lô (Lot Number)
  - Chuyển lô (Crossover Study)
  - Đánh giá hồi cứu (Retrospective Review)
  - Xử lý sự cố (Troubleshooting)
  - Phiên QC (QC Session) - NEW
  - Chế độ phiên (Session Mode) - NEW
- [ ] 17.2 Translate all UI labels in QC components
- [ ] 17.3 Translate validation error messages
- [ ] 17.4 Translate system alerts and notifications

## 18. Documentation
- [ ] 18.1 Create docs/QC_USER_GUIDE.md with Vietnamese terminology
- [ ] 18.2 Create docs/SOP_DAILY_QC_ENTRY.md
- [ ] 18.3 Create docs/SOP_QC_VIOLATION_HANDLING.md
- [ ] 18.4 Create docs/SOP_ESTABLISHING_CONTROL_LIMITS.md
- [ ] 18.5 Create docs/SOP_LOT_CHANGEOVER.md
- [ ] 18.6 Create docs/SIX_SIGMA_TRAINING.md
- [ ] 18.7 Create docs/SOP_QC_SESSION_MANAGEMENT.md (NEW)

## 19. Testing
- [ ] 19.1 Write unit tests for westgard-rules.ts
- [ ] 19.2 Write unit tests for sigma-metrics.ts
- [ ] 19.3 Write integration tests for QC Server Actions
- [ ] 19.4 Write E2E tests for QC entry workflow
- [ ] 19.5 Write E2E tests for session management
- [ ] 19.6 Write E2E tests for violation resolution
- [ ] 19.7 Write security tests for RLS policies
- [ ] 19.8 Test approval blocking mechanism with NULL and blocked sessions
- [ ] 19.9 Test that NULL qc_session_id allows approval (pre-QC era)

## 20. Deployment
- [ ] 20.1 Review migration for production safety (idempotent SQL)
- [ ] 20.2 Verify no backfill is needed for results.qc_session_id
- [ ] 20.3 Apply migration to development database
- [ ] 20.4 Verify with npm run typecheck
- [ ] 20.5 Test all workflows in development
- [ ] 20.6 Create deployment checklist
- [ ] 20.7 Apply to production database
- [ ] 20.8 Monitor for errors in first 24 hours
- [ ] 20.9 Conduct user training sessions

## Implementation Notes

**Key Design Decisions (Validated 2025-12-31):**
- Session-based QC linking via `qc_sessions` table (no `runs` table exists)
- Use `assay_definitions.id` (not `tests.id` which doesn't exist)
- Block at approval time, not entry time
- No instrument tracking for MVP
- No backfill for `results.qc_session_id` - NULL = pre-QC era (compliant)
- Manager-configurable QC modes: daily, batch, shift, none

**Priority Order:**
1. Database schema (1) - Foundation
2. Type definitions (2) - Type safety
3. Rule engine (3) + Sigma metrics (4) - Core logic
4. Server Actions (5) - API layer
5. UI Components (7-13) - User interface
6. Pages (14-15) - Page integration
7. Approval Integration (16) - Blocking mechanism
8. Localization (17) - User experience
9. Testing (19) - Quality assurance
10. Documentation (18) - Knowledge transfer
11. Deployment (20) - Production rollout

**Estimated Complexity:**
- High: Rule evaluation engine, Levey-Jennings chart, Approval integration
- Medium: Database schema, Server Actions, UI components, Session management
- Low: Vietnamese localization, documentation

**Critical Path:**
Database → Types → Rule Engine → Server Actions → QC Entry UI → Approval Integration → Testing → Deployment
