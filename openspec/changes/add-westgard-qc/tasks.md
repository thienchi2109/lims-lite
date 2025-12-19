# Implementation Tasks - Westgard QC System

## 1. Database Schema & Migration
- [ ] 1.1 Create `qc_materials` table with soft delete
- [ ] 1.2 Create `qc_definitions` table with active_date tracking
- [ ] 1.3 Create `qc_results` table with z_score auto-calculation trigger
- [ ] 1.4 Create `qc_violations` table with corrective action requirements
- [ ] 1.5 Add RLS policies for Analyst role (INSERT, SELECT only)
- [ ] 1.6 Add RLS policies for Manager role (full access to definitions)
- [ ] 1.7 Create database trigger for auto Z-score calculation on INSERT
- [ ] 1.8 Create indexes on qc_results (definition_id, run_id, measured_at)
- [ ] 1.9 Add foreign key constraints to tests and instruments tables
- [ ] 1.10 Create qc_tea_standards table for Total Allowable Error configuration
- [ ] 1.11 Test migration with sample data
- [ ] 1.12 Run security tests: `docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"`

## 2. Type Definitions & Schemas
- [ ] 2.1 Define Zod schemas for qc_materials in src/types/index.ts
- [ ] 2.2 Define Zod schemas for qc_definitions with validation rules
- [ ] 2.3 Define Zod schemas for qc_results with Z-score
- [ ] 2.4 Define Zod schemas for qc_violations with corrective action
- [ ] 2.5 Define TypeScript types for Westgard rule names
- [ ] 2.6 Define TypeScript types for QC status enums
- [ ] 2.7 Export all QC types and schemas

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
- [ ] 5.3 Implement createQCDefinition(formData) - Set control limits
- [ ] 5.4 Implement enterQCResult(formData) - Daily entry with rule evaluation
- [ ] 5.5 Implement resolveViolation(violationId, correctiveAction) - Manager action
- [ ] 5.6 Implement blockPatientResults(runId, testId) - Auto-blocking
- [ ] 5.7 Implement flagPreviousResults(qcResultId) - Retrospective review
- [ ] 5.8 Implement getQCHistory(definitionId, days) - Chart data
- [ ] 5.9 Implement getLotChangeoverData(materialId) - Crossover protocol
- [ ] 5.10 Add Zod validation to all Server Actions
- [ ] 5.11 Add audit logging to all mutations

## 6. Database Helper Functions
- [ ] 6.1 Create PostgreSQL function for Z-score calculation trigger
- [ ] 6.2 Create PostgreSQL function for patient result blocking
- [ ] 6.3 Create PostgreSQL function for retrospective flagging
- [ ] 6.4 Grant EXECUTE permissions to authenticated role

## 7. UI Components - QC Entry
- [ ] 7.1 Create src/components/qc/qc-entry-form.tsx
- [ ] 7.2 Add form fields: test selection, material/level, value
- [ ] 7.3 Integrate react-hook-form with Zod validation
- [ ] 7.4 Display real-time Z-score calculation
- [ ] 7.5 Show immediate rule violation alerts
- [ ] 7.6 Add Vietnamese labels and error messages
- [ ] 7.7 Test form submission and error handling

## 8. UI Components - Levey-Jennings Chart
- [ ] 8.1 Create src/components/qc/levey-jennings-chart.tsx
- [ ] 8.2 Install recharts: npm install recharts
- [ ] 8.3 Implement chart with Mean ± 1SD, 2SD, 3SD reference lines
- [ ] 8.4 Color-code data points: Green (pass), Yellow (1-2s), Red (reject)
- [ ] 8.5 Add tooltips showing value, Z-score, rule violations
- [ ] 8.6 Add date range filter
- [ ] 8.7 Add export to PDF functionality
- [ ] 8.8 Ensure responsive design for mobile/tablet

## 9. UI Components - Violation Resolution
- [ ] 9.1 Create src/components/qc/violation-resolution-dialog.tsx
- [ ] 9.2 Display violation details (rule violated, timestamp, value)
- [ ] 9.3 Add corrective action text area (required field)
- [ ] 9.4 Add troubleshooting guidance checklist
- [ ] 9.5 Implement electronic signature for Manager approval
- [ ] 9.6 Block dialog closure until corrective action entered
- [ ] 9.7 Add Vietnamese labels

## 10. UI Components - Control Limits Wizard
- [ ] 10.1 Create src/components/qc/control-limits-wizard.tsx
- [ ] 10.2 Add step 1: Select test and QC material
- [ ] 10.3 Add step 2: Enter 20 initial data points
- [ ] 10.4 Add step 3: Calculate Mean and SD
- [ ] 10.5 Add step 4: Review and approve limits (Manager only)
- [ ] 10.6 Display progress indicator (X/20 points collected)
- [ ] 10.7 Validate minimum 20 points over 10+ days
- [ ] 10.8 Add Vietnamese instructions

## 11. UI Components - Lot Changeover
- [ ] 11.1 Create src/components/qc/lot-changeover-dialog.tsx
- [ ] 11.2 Display old lot vs new lot comparison table
- [ ] 11.3 Track crossover data points (minimum 10 required)
- [ ] 11.4 Calculate new Mean and copy CV% from old lot
- [ ] 11.5 Add patient sample comparison workflow
- [ ] 11.6 Require Manager approval for new limits
- [ ] 11.7 Add Vietnamese labels

## 12. Pages - Analyst QC Entry
- [ ] 12.1 Create src/app/(dashboard)/analyst/qc-entry/page.tsx
- [ ] 12.2 Display list of tests requiring daily QC
- [ ] 12.3 Show current QC status per test (Pass/Warning/Reject)
- [ ] 12.4 Integrate qc-entry-form component
- [ ] 12.5 Display mini Levey-Jennings chart for last 30 days
- [ ] 12.6 Add Vietnamese page title and instructions

## 13. Pages - Manager QC Management
- [ ] 13.1 Create src/app/(dashboard)/manager/quality-control/page.tsx
- [ ] 13.2 Display all QC materials and definitions table
- [ ] 13.3 Add "Establish New Limits" button → control-limits-wizard
- [ ] 13.4 Add "Lot Changeover" button → lot-changeover-dialog
- [ ] 13.5 Display pending violations requiring resolution
- [ ] 13.6 Add comprehensive Levey-Jennings chart with filters
- [ ] 13.7 Add Six Sigma metrics dashboard
- [ ] 13.8 Add Vietnamese page title and labels

## 14. Vietnamese Localization
- [ ] 14.1 Add QC terminology to docs/vietnamese_dictionary.md:
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
- [ ] 14.2 Translate all UI labels in QC components
- [ ] 14.3 Translate validation error messages
- [ ] 14.4 Translate system alerts and notifications

## 15. Documentation
- [ ] 15.1 Create docs/QC_USER_GUIDE.md with Vietnamese terminology
- [ ] 15.2 Create docs/SOP_DAILY_QC_ENTRY.md
- [ ] 15.3 Create docs/SOP_QC_VIOLATION_HANDLING.md
- [ ] 15.4 Create docs/SOP_ESTABLISHING_CONTROL_LIMITS.md
- [ ] 15.5 Create docs/SOP_LOT_CHANGEOVER.md
- [ ] 15.6 Create docs/SIX_SIGMA_TRAINING.md

## 16. Testing
- [ ] 16.1 Write unit tests for westgard-rules.ts
- [ ] 16.2 Write unit tests for sigma-metrics.ts
- [ ] 16.3 Write integration tests for QC Server Actions
- [ ] 16.4 Write E2E tests for QC entry workflow
- [ ] 16.5 Write E2E tests for violation resolution
- [ ] 16.6 Write security tests for RLS policies
- [ ] 16.7 Test patient result blocking mechanism
- [ ] 16.8 Test retrospective review flagging

## 17. Deployment
- [ ] 17.1 Review migration for production safety (idempotent SQL)
- [ ] 17.2 Apply migration to development database
- [ ] 17.3 Verify with npm run typecheck
- [ ] 17.4 Test all workflows in development
- [ ] 17.5 Create deployment checklist
- [ ] 17.6 Apply to production database
- [ ] 17.7 Monitor for errors in first 24 hours
- [ ] 17.8 Conduct user training sessions

## Implementation Notes

**Priority Order:**
1. Database schema (1) - Foundation
2. Rule engine (3) + Sigma metrics (4) - Core logic
3. Server Actions (5) - API layer
4. UI Components (7-11) - User interface
5. Pages (12-13) - Integration
6. Localization (14) - User experience
7. Testing (16) - Quality assurance
8. Documentation (15) - Knowledge transfer
9. Deployment (17) - Production rollout

**Estimated Complexity:**
- High: Rule evaluation engine, Levey-Jennings chart
- Medium: Database schema, Server Actions, UI components
- Low: Vietnamese localization, documentation

**Critical Path:**
Database → Rule Engine → Server Actions → QC Entry UI → Testing → Deployment
