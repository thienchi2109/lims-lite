# Quality Control Specification - Delta

## ADDED Requirements

### Requirement: QC Material Management
The system SHALL allow managers to register and track quality control materials including lot numbers, expiration dates, and concentration levels.

#### Scenario: Register new QC material
- **GIVEN** a manager is logged in
- **WHEN** they submit a QC material form with material name, lot number, level (Low/Normal/High), and expiration date
- **THEN** the system SHALL create a new qc_materials record
- **AND** log the action in the audit trail with manager's user ID

#### Scenario: Prevent duplicate lot numbers
- **GIVEN** a QC material with lot number "ABC123" already exists
- **WHEN** a manager attempts to register another material with the same lot number
- **THEN** the system SHALL reject the submission with error "Số lô đã tồn tại" (Lot number already exists)

#### Scenario: Soft delete expired materials
- **GIVEN** a QC material has reached its expiration date
- **WHEN** a manager marks it as deleted
- **THEN** the system SHALL set deleted_at timestamp
- **AND** the material SHALL NOT appear in active material lists
- **AND** historical QC data using this material SHALL remain accessible

### Requirement: Control Limits Establishment
The system SHALL allow managers to establish lab-specific control limits (Mean and Standard Deviation) for each test-instrument-material combination based on minimum 20 data points collected over 10-20 days.

#### Scenario: Create new control limits
- **GIVEN** a manager has collected 20 QC measurements over 15 days
- **WHEN** they submit the control limits wizard with calculated Mean and SD
- **THEN** the system SHALL create a new qc_definitions record
- **AND** set active_date to today
- **AND** mark is_active as true
- **AND** capture electronic signature from manager
- **AND** log the action in audit trail

#### Scenario: Warn if insufficient data points
- **GIVEN** a manager attempts to establish limits with only 15 data points
- **WHEN** they review the limits in the wizard
- **THEN** the system SHALL display warning "Khuyến nghị tối thiểu 20 điểm dữ liệu. Bạn có chắc chắn muốn tiếp tục?" (Recommended minimum 20 data points. Are you sure you want to continue?)
- **AND** require explicit manager acknowledgment before allowing activation

#### Scenario: Prevent analyst from modifying limits
- **GIVEN** an analyst is logged in
- **WHEN** they attempt to UPDATE a qc_definitions record
- **THEN** the system SHALL reject the operation via RLS policy
- **AND** return error "Không có quyền thực hiện thao tác này" (No permission to perform this operation)

### Requirement: Daily QC Entry
The system SHALL allow analysts to enter daily QC measurements and automatically calculate Z-scores in real-time.

#### Scenario: Enter QC result with auto Z-score calculation
- **GIVEN** an analyst selects test "Glucose" with QC material "Bio-Rad Level 1"
- **AND** the control limits are Mean=100, SD=5
- **WHEN** they enter value=110
- **THEN** the system SHALL automatically calculate z_score = (110-100)/5 = 2.0
- **AND** save the qc_results record with z_score=2.0
- **AND** display the Z-score immediately in the UI

#### Scenario: Link QC to run ID
- **GIVEN** an analyst is processing run "RUN-2025-001"
- **WHEN** they enter QC results for this run
- **THEN** the system SHALL associate the qc_results.run_id with "RUN-2025-001"
- **AND** enable within-run rule evaluation (R-4s, 2-2s within-run)

### Requirement: Westgard Multirule Evaluation
The system SHALL evaluate all QC results against Westgard Multirules (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10-x) immediately upon data entry and classify as Pass/Warning/Reject.

#### Scenario: 1-3s rule violation (Random Error)
- **GIVEN** a QC result has z_score = 3.2
- **WHEN** the system evaluates Westgard rules
- **THEN** the system SHALL create a qc_violations record with rule_violated='1-3s', status='reject'
- **AND** set qc_results.status = 'reject'
- **AND** trigger automatic patient result blocking for this run

#### Scenario: 1-2s warning (No rejection)
- **GIVEN** a QC result has z_score = 2.1
- **WHEN** the system evaluates Westgard rules
- **THEN** the system SHALL create a qc_violations record with rule_violated='1-2s', status='warning'
- **AND** set qc_results.status = 'warning'
- **AND** NOT block patient results
- **AND** display yellow warning indicator in UI

#### Scenario: 2-2s across-run violation (Systematic Error)
- **GIVEN** the current QC result has z_score = 2.3
- **AND** the previous QC result for the same level has z_score = 2.2
- **WHEN** the system evaluates Westgard rules
- **THEN** the system SHALL detect both results on same side of Mean beyond 2SD
- **AND** create a qc_violations record with rule_violated='2-2s', status='reject'
- **AND** trigger automatic patient result blocking

#### Scenario: R-4s within-run violation (Random Error)
- **GIVEN** a run has QC Level 1 with z_score = +2.5
- **AND** the same run has QC Level 2 with z_score = -2.0
- **WHEN** the system evaluates Westgard rules
- **THEN** the system SHALL calculate range = |2.5 - (-2.0)| = 4.5
- **AND** detect range >= 4SD
- **AND** create a qc_violations record with rule_violated='R-4s', status='reject'

#### Scenario: 4-1s trend violation (Systematic Error)
- **GIVEN** the last 4 consecutive QC results have z_scores: [1.2, 1.5, 1.3, 1.4]
- **WHEN** the system evaluates Westgard rules
- **THEN** the system SHALL detect all 4 results > +1SD
- **AND** create a qc_violations record with rule_violated='4-1s', status='reject'

#### Scenario: 10-x shift violation (Systematic Error)
- **GIVEN** the last 10 consecutive QC results are all on the positive side of Mean
- **WHEN** the system evaluates Westgard rules
- **THEN** the system SHALL detect systematic shift
- **AND** create a qc_violations record with rule_violated='10-x', status='reject'

#### Scenario: Pass all rules
- **GIVEN** a QC result has z_score = 0.8
- **AND** no historical patterns violate multi-result rules
- **WHEN** the system evaluates Westgard rules
- **THEN** the system SHALL set qc_results.status = 'pass'
- **AND** NOT create any qc_violations records
- **AND** allow patient results to be released

### Requirement: Automatic Patient Result Blocking
The system SHALL automatically block release of patient results when QC violates rejection rules (1-3s, 2-2s, R-4s, 4-1s, 10-x) until corrective action is completed and new QC passes.

#### Scenario: Block patient results on QC rejection
- **GIVEN** a QC result violates rule '1-3s' with status='reject'
- **WHEN** the violation is created
- **THEN** the system SHALL update runs.qc_status = 'blocked' for run_id
- **AND** prevent any result approval actions on this run
- **AND** display error "Không thể phát hành kết quả. QC đang mất kiểm soát." (Cannot release results. QC is out of control.)

#### Scenario: Retrospective patient result flagging
- **GIVEN** a QC violation occurs at 10:30 AM
- **AND** the last passed QC was at 8:00 AM
- **WHEN** the violation is detected
- **THEN** the system SHALL flag all patient results processed between 8:00 AM and 10:30 AM
- **AND** require manager review before releasing these results
- **AND** create audit log entry with flagged result IDs

#### Scenario: Unlock results after corrective action
- **GIVEN** a run has qc_status='blocked' due to QC violation
- **AND** a manager has entered corrective action and approved
- **AND** a new QC result passes all rules
- **WHEN** the manager resolves the violation
- **THEN** the system SHALL update runs.qc_status = 'resolved'
- **AND** allow patient results to be released
- **AND** log resolution in audit trail with manager's electronic signature

### Requirement: QC Violation Resolution
The system SHALL require managers to enter corrective actions and provide electronic signatures before resolving QC violations and unblocking patient results.

#### Scenario: Resolve QC violation with corrective action
- **GIVEN** a QC violation exists with status='reject'
- **AND** a manager opens the violation resolution dialog
- **WHEN** they enter corrective action "Recalibrated instrument, replaced reagent lot"
- **AND** provide electronic signature
- **THEN** the system SHALL update qc_violations.corrective_action
- **AND** set qc_violations.resolved_at to current timestamp
- **AND** set qc_violations.resolved_by to manager's user ID
- **AND** log the resolution in audit trail

#### Scenario: Prevent resolution without corrective action
- **GIVEN** a QC violation exists with status='reject'
- **WHEN** a manager attempts to resolve without entering corrective action
- **THEN** the system SHALL display error "Hành động khắc phục là bắt buộc" (Corrective action is required)
- **AND** prevent the violation from being marked as resolved

#### Scenario: Prevent analyst from resolving violations
- **GIVEN** an analyst is logged in
- **WHEN** they attempt to UPDATE a qc_violations record
- **THEN** the system SHALL reject the operation via RLS policy
- **AND** return error "Chỉ quản lý mới có quyền giải quyết vi phạm QC" (Only managers can resolve QC violations)

### Requirement: Levey-Jennings Chart Visualization
The system SHALL display interactive Levey-Jennings charts showing QC results over time with color-coded violation indicators and reference lines at Mean ± 1SD, 2SD, 3SD.

#### Scenario: Display Levey-Jennings chart with reference lines
- **GIVEN** a test has control limits Mean=100, SD=5
- **WHEN** a user views the Levey-Jennings chart
- **THEN** the system SHALL display horizontal reference lines at:
  - Central line: 100 (Mean)
  - +1SD: 105, -1SD: 95
  - +2SD: 110, -2SD: 90
  - +3SD: 115, -3SD: 85
- **AND** label each line in Vietnamese

#### Scenario: Color-code data points by status
- **GIVEN** a QC results history contains Pass, Warning, and Reject results
- **WHEN** the Levey-Jennings chart is rendered
- **THEN** the system SHALL display:
  - Green points for status='pass'
  - Yellow points for status='warning'
  - Red points for status='reject'
- **AND** show tooltip on hover with value, Z-score, and violated rule

#### Scenario: Filter chart by date range
- **GIVEN** a user selects date range "Last 30 days"
- **WHEN** the chart is rendered
- **THEN** the system SHALL display only QC results where measured_at is within the last 30 days
- **AND** update reference lines if control limits changed during this period

#### Scenario: Export chart to PDF
- **GIVEN** a user views a Levey-Jennings chart
- **WHEN** they click "Xuất PDF" (Export PDF)
- **THEN** the system SHALL generate a PDF report containing:
  - Chart with all data points and reference lines
  - Test name, QC material, date range
  - Summary statistics (Mean, SD, violations count)
  - Electronic signature and timestamp

### Requirement: Six Sigma Metrics Calculation
The system SHALL calculate Six Sigma metrics (Bias, CV, Sigma) for each test and automatically select appropriate Westgard rules based on Sigma score.

#### Scenario: Calculate Sigma metrics
- **GIVEN** a test has lab Mean=100, SD=5, peer group Mean=98, TEa=10%
- **WHEN** the system calculates Six Sigma metrics
- **THEN** the system SHALL calculate:
  - Bias = |(100-98)/98| × 100 = 2.04%
  - CV = (5/100) × 100 = 5%
  - Sigma = (10 - 2.04) / 5 = 1.59
- **AND** store calculated metrics in database

#### Scenario: Auto-select relaxed rules for high Sigma (>6)
- **GIVEN** a test has Sigma score = 6.5
- **WHEN** the system evaluates QC results
- **THEN** the system SHALL apply only rule 1-3s (minimal QC)
- **AND** NOT apply rules 2-2s, R-4s, 4-1s, 10-x
- **AND** display message "Quy trình có năng lực cao (Sigma>6). Sử dụng luật đơn giản." (High-capability process (Sigma>6). Using simplified rules.)

#### Scenario: Auto-select full Multirules for low Sigma (<4)
- **GIVEN** a test has Sigma score = 3.2
- **WHEN** the system evaluates QC results
- **THEN** the system SHALL apply all Westgard Multirules (1-3s, 2-2s, R-4s, 4-1s, 10-x)
- **AND** display message "Quy trình cần giám sát chặt chẽ (Sigma<4). Sử dụng đa quy tắc Westgard." (Process requires close monitoring (Sigma<4). Using Westgard Multirules.)

### Requirement: QC Lot Changeover Management
The system SHALL support lot changeover protocol allowing parallel running of old and new QC lots with minimum 10 data points to establish new control limits while preserving old lot CV%.

#### Scenario: Initiate lot changeover
- **GIVEN** a manager initiates lot changeover from lot "ABC123" to lot "DEF456"
- **WHEN** they enter the lot changeover dialog
- **THEN** the system SHALL display side-by-side comparison of old and new lot data
- **AND** require minimum 10 crossover data points for new lot
- **AND** calculate new Mean from crossover data
- **AND** copy CV% from old lot to new lot initially

#### Scenario: Approve new lot limits
- **GIVEN** a manager has collected 12 crossover data points for new lot "DEF456"
- **AND** the new Mean=105, old CV%=5%, new SD=5.25 (calculated from CV)
- **WHEN** the manager approves the new limits
- **THEN** the system SHALL create new qc_definitions record with active_date=today
- **AND** set old qc_definitions.is_active=false
- **AND** log the changeover in audit trail with electronic signature

#### Scenario: Warn about commutability issues
- **GIVEN** a lot changeover shows significant Mean shift (>10%)
- **WHEN** the manager reviews crossover data
- **THEN** the system SHALL display warning "Chênh lệch Mean >10%. Kiểm tra so sánh mẫu bệnh nhân." (Mean difference >10%. Verify with patient sample comparison.)
- **AND** require manager acknowledgment before allowing approval

### Requirement: Audit Trail for QC Activities
The system SHALL capture complete audit trail for all QC activities including data entry, violations, resolutions, and limit approvals in compliance with 21 CFR Part 11.

#### Scenario: Log QC result entry
- **GIVEN** an analyst enters a QC result
- **WHEN** the qc_results record is created
- **THEN** the system SHALL create audit_logs record containing:
  - who: analyst's user ID
  - what: 'insert_qc_result'
  - when: current timestamp
  - details: JSON with test_id, material_id, value, z_score

#### Scenario: Log violation resolution
- **GIVEN** a manager resolves a QC violation
- **WHEN** the qc_violations.corrective_action is updated
- **THEN** the system SHALL create audit_logs record containing:
  - who: manager's user ID
  - what: 'resolve_qc_violation'
  - when: current timestamp
  - why: corrective action text
  - electronic_signature: manager's signature

#### Scenario: Log control limits approval
- **GIVEN** a manager approves new control limits
- **WHEN** the qc_definitions record is created
- **THEN** the system SHALL create audit_logs record containing:
  - who: manager's user ID
  - what: 'approve_qc_limits'
  - when: current timestamp
  - details: JSON with test_id, material_id, mean, sd, data_points_count
  - electronic_signature: manager's signature

### Requirement: Vietnamese Localization for QC Terminology
The system SHALL display all QC-related UI elements, labels, and messages in Vietnamese using standardized terminology from vietnamese_dictionary.md.

#### Scenario: Display Vietnamese QC form labels
- **GIVEN** an analyst opens the QC entry form
- **WHEN** the form is rendered
- **THEN** all field labels SHALL be in Vietnamese:
  - "Xét nghiệm" (Test)
  - "Vật liệu QC" (QC Material)
  - "Giá trị đo" (Measured Value)
  - "Z-score"
  - "Trạng thái" (Status)

#### Scenario: Display Vietnamese violation messages
- **GIVEN** a QC violation occurs
- **WHEN** the violation alert is shown
- **THEN** the message SHALL be in Vietnamese:
  - "Vi phạm quy tắc 1-3s: Sai số ngẫu nhiên" (Violates rule 1-3s: Random Error)
  - "Kết quả bệnh nhân đã bị chặn. Cần hành động khắc phục." (Patient results blocked. Corrective action required.)

#### Scenario: Display Vietnamese chart labels
- **GIVEN** a Levey-Jennings chart is displayed
- **WHEN** the chart is rendered
- **THEN** all labels SHALL be in Vietnamese:
  - "Giá trị trung bình" (Mean)
  - "Giới hạn kiểm soát" (Control Limits)
  - "Đạt" (Pass)
  - "Cảnh báo" (Warning)
  - "Vi phạm" (Reject)
