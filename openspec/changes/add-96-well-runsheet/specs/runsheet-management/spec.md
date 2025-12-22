## ADDED Requirements

### Requirement: Runsheet Management

The system SHALL provide a 96-well plate runsheet management capability that allows laboratory technicians to digitally map physical sample positions in microplate wells for instrument analysis.

#### Scenario: Create new runsheet
- **GIVEN** an authenticated analyst user
- **AND** assays are configured in the system
- **WHEN** the user navigates to "Phiếu chạy mẫu" and clicks "Tạo mới"
- **AND** selects an assay (and optionally a method)
- **THEN** the system creates a new runsheet with auto-generated plate number (format: `PLATE-YYYY-NNNN`)
- **AND** initializes an 8×12 grid (96 wells) with all wells empty
- **AND** displays the interactive plate grid editor

#### Scenario: View runsheet list
- **GIVEN** an authenticated user (analyst or manager)
- **WHEN** the user navigates to "Phiếu chạy mẫu"
- **THEN** the system displays a paginated list of runsheets
- **AND** shows plate number, assay name, status, created date, and creator
- **AND** allows filtering by status (draft, running, completed, voided)
- **AND** analysts see only their own runsheets
- **AND** managers see all runsheets

---

### Requirement: Sample Assignment to Wells

The system SHALL enable assignment of eligible samples to specific well positions on a runsheet, with only samples that have assigned pending tests being available for selection.

#### Scenario: View eligible samples for assignment
- **GIVEN** an analyst is editing a runsheet for a specific assay
- **WHEN** the sample picker panel is displayed
- **THEN** the system shows only samples where:
  - Sample status is `assigned` or `in_progress`
  - Sample has a pending result for the selected assay
  - Result is not already assigned to another runsheet well
- **AND** samples are sorted by received date (oldest first)
- **AND** search functionality is available to filter by sample ID

#### Scenario: Assign single sample to well
- **GIVEN** an analyst has selected a sample from the picker
- **AND** has selected an empty well on the plate grid
- **WHEN** the assignment action is triggered
- **THEN** the system assigns the sample's pending result to that well
- **AND** the well displays the sample ID
- **AND** the well is colored to indicate "sample" type
- **AND** the sample is removed from the available samples list

#### Scenario: Batch assign samples to wells (fill by row)
- **GIVEN** an analyst has selected multiple samples from the picker (ordered by selection)
- **AND** has selected a starting well position (e.g., A1)
- **WHEN** the "Điền theo hàng" (Fill by Row) action is triggered
- **THEN** the system assigns samples sequentially: A1→A2→...→A12→B1→B2→...
- **AND** skips wells that are not empty or are marked as blocked
- **AND** stops when all selected samples are assigned or all wells are filled

#### Scenario: Batch assign samples to wells (fill by column)
- **GIVEN** an analyst has selected multiple samples from the picker
- **AND** has selected a starting well position (e.g., A1)
- **WHEN** the "Điền theo cột" (Fill by Column) action is triggered
- **THEN** the system assigns samples sequentially: A1→B1→...→H1→A2→B2→...
- **AND** skips wells that are not empty or are marked as blocked

#### Scenario: Clear well assignment
- **GIVEN** an analyst has selected one or more assigned wells
- **WHEN** the "Xóa chọn" (Clear Selected) action is triggered
- **THEN** the system removes the result assignment from those wells
- **AND** the wells return to "empty" state
- **AND** the cleared samples return to the available samples list

---

### Requirement: Well Type Classification

The system SHALL support different well types to accommodate QC sample positioning on the plate, including blanks, standards, and controls.

#### Scenario: Set well as blank
- **GIVEN** an analyst has selected one or more wells
- **WHEN** the well type is changed to "Mẫu trắng" (Blank)
- **THEN** the selected wells are marked as blank type
- **AND** display with distinct blank color coding
- **AND** any previous sample assignment is cleared

#### Scenario: Set well as standard with concentration
- **GIVEN** an analyst has selected one or more wells
- **WHEN** the well type is changed to "Mẫu chuẩn" (Standard)
- **THEN** the system prompts for concentration value
- **AND** the wells are marked as standard type with the entered concentration
- **AND** display with distinct standard color coding

#### Scenario: Set well as QC control
- **GIVEN** an analyst has selected one or more wells
- **WHEN** the well type is changed to "Mẫu QC" (Control)
- **THEN** the selected wells are marked as control type
- **AND** display with distinct control color coding

---

### Requirement: Well Exclusion

The system SHALL allow analysts to exclude specific wells from analysis with a documented reason, supporting 21 CFR Part 11 compliance requirements.

#### Scenario: Exclude well from analysis
- **GIVEN** an analyst identifies a well with an issue (e.g., pipetting error)
- **WHEN** the exclude action is triggered on that well
- **THEN** the system prompts for an exclusion reason (required)
- **AND** marks the well as excluded
- **AND** the well is visually distinguished (strikethrough or dimmed)
- **AND** the exclusion is logged in the audit trail with timestamp and user

#### Scenario: View excluded well details
- **GIVEN** a runsheet has wells marked as excluded
- **WHEN** a user hovers over an excluded well
- **THEN** a tooltip displays the exclusion reason, timestamp, and user who excluded it

---

### Requirement: Well Selection Interactions

The system SHALL provide efficient multi-selection capabilities for the 96-well grid, supporting both mouse and keyboard interactions.

#### Scenario: Select single well
- **GIVEN** an analyst is viewing the plate grid
- **WHEN** the user clicks on a well
- **THEN** that well is selected (highlighted)
- **AND** any previous selection is cleared

#### Scenario: Range select with Shift+click
- **GIVEN** an analyst has selected well A1
- **WHEN** the user Shift+clicks on well C3
- **THEN** all wells in the rectangular region A1:C3 are selected (9 wells total)

#### Scenario: Add to selection with Ctrl+click
- **GIVEN** an analyst has wells A1 and A2 selected
- **WHEN** the user Ctrl+clicks on well H12
- **THEN** H12 is added to the selection (now 3 wells selected)
- **AND** the original selection remains

#### Scenario: Select entire row
- **GIVEN** an analyst is viewing the plate grid
- **WHEN** the user clicks on row header "B"
- **THEN** all 12 wells in row B are selected (B1-B12)

#### Scenario: Select entire column
- **GIVEN** an analyst is viewing the plate grid
- **WHEN** the user clicks on column header "5"
- **THEN** all 8 wells in column 5 are selected (A5-H5)

#### Scenario: Keyboard navigation
- **GIVEN** a well is currently focused
- **WHEN** the user presses arrow keys
- **THEN** focus moves to the adjacent well in that direction
- **AND** Tab key moves focus to next well (by row)
- **AND** Enter key triggers the current selection action

---

### Requirement: Runsheet Status Workflow

The system SHALL enforce a status workflow for runsheets that tracks the plate through its lifecycle from creation to completion.

#### Scenario: Save draft runsheet
- **GIVEN** an analyst is editing a new or existing draft runsheet
- **WHEN** the "Lưu" (Save) action is triggered
- **THEN** the current plate configuration is persisted
- **AND** the runsheet status remains "draft"
- **AND** the analyst can continue editing

#### Scenario: Start instrument run
- **GIVEN** an analyst has a draft runsheet with at least one assigned sample
- **WHEN** the "Bắt đầu chạy" (Start Run) action is triggered
- **THEN** the runsheet status changes to "running"
- **AND** well assignments become locked (no further changes allowed)
- **AND** linked sample results status changes to "in_progress"

#### Scenario: Complete runsheet
- **GIVEN** a runsheet is in "running" status
- **AND** all sample wells have result values entered
- **WHEN** the "Hoàn thành" (Complete) action is triggered
- **THEN** the runsheet status changes to "completed"
- **AND** the runsheet becomes read-only

#### Scenario: Void runsheet
- **GIVEN** a runsheet exists (any status except completed)
- **WHEN** a manager triggers the "Hủy phiếu" (Void) action
- **THEN** the system prompts for a void reason (required)
- **AND** the runsheet status changes to "voided"
- **AND** the void is recorded in audit log

---

### Requirement: Runsheet Audit Trail

The system SHALL maintain a complete audit trail of all runsheet modifications in compliance with 21 CFR Part 11 requirements for electronic records.

#### Scenario: Audit well assignment
- **GIVEN** an analyst assigns a sample to a well
- **WHEN** the action is completed
- **THEN** an audit record is created with:
  - User ID
  - Timestamp
  - Action type: "well_assigned"
  - Old value: "empty" (or previous sample ID)
  - New value: sample ID
  - Well position

#### Scenario: Audit well exclusion
- **GIVEN** an analyst excludes a well
- **WHEN** the action is completed
- **THEN** an audit record is created with:
  - User ID
  - Timestamp
  - Action type: "well_excluded"
  - Exclusion reason
  - Well position

#### Scenario: Audit status change
- **GIVEN** a runsheet status changes
- **WHEN** the transition is completed
- **THEN** an audit record is created with:
  - User ID
  - Timestamp
  - Action type: "status_change"
  - Old status
  - New status
  - Reason (if applicable)

---

### Requirement: Visual Well State Representation

The system SHALL provide clear visual distinction between different well states and types through consistent color coding and status indicators.

#### Scenario: Display well color legend
- **GIVEN** an analyst is viewing the plate grid
- **THEN** a legend is visible showing:
  - Empty wells: Light gray
  - Sample wells: Blue
  - Blank wells: White with border
  - Standard wells: Green
  - Control (QC) wells: Orange
  - Excluded wells: Red strikethrough overlay

#### Scenario: Display well content on hover
- **GIVEN** a well has content assigned
- **WHEN** the user hovers over the well
- **THEN** a tooltip displays:
  - Well position (e.g., "A1")
  - Sample ID (if assigned)
  - Well type
  - Concentration (if standard)
  - Exclusion info (if excluded)

---

### Requirement: Result Entry on Plate Grid

The system SHALL provide result value entry directly on the plate grid with an expandable detail panel, enabling a focused single-page experience for analysts during instrument runs.

#### Scenario: Enter result value from plate grid
- **GIVEN** a runsheet is in "running" status
- **AND** an analyst clicks on an assigned well
- **WHEN** the detail panel expands
- **THEN** the system displays:
  - Well position and sample ID
  - Assay name and expected units
  - Value input field with validation
  - Notes field (optional)
  - Save and Next Well buttons
- **AND** the analyst can enter the result value
- **AND** keyboard Enter saves and moves to next well

#### Scenario: Navigate between wells during entry
- **GIVEN** an analyst is entering results on the plate grid
- **WHEN** the analyst presses Tab or clicks "Next Well"
- **THEN** focus moves to the next assigned well (by row or column based on fill direction setting)
- **AND** the detail panel updates to show the new well's information

#### Scenario: View result status on plate grid
- **GIVEN** a runsheet is in "running" status
- **THEN** each well displays a visual indicator of result status:
  - Pending (no value): outline only
  - Entered (has value): filled with type color
  - Submitted: filled with checkmark overlay
  - Approved: filled with green border
  - Rejected: filled with red border

---

### Requirement: Partial Plate Submission

The system SHALL support submitting selected wells for review from the plate view, enabling flexibility when different samples complete at different times.

#### Scenario: Submit selected wells for review
- **GIVEN** an analyst is viewing a runsheet in "running" status
- **AND** has selected one or more wells with status "entered"
- **WHEN** the "Gửi duyệt" (Submit for Review) action is triggered
- **THEN** the linked results' samples transition to "review" status
- **AND** the wells display submission status indicator
- **AND** submitted wells cannot be edited unless rejected

#### Scenario: Identify submittable wells
- **GIVEN** an analyst is viewing a running runsheet
- **THEN** wells are visually distinguished by submission eligibility:
  - Ready to submit: "entered" status, can be selected
  - Not ready: "pending" status (no value entered)
  - Already submitted: grayed out or badge indicator

---

### Requirement: Manager Plate Review

The system SHALL provide managers with both sample-based and plate-based review views, enabling efficient routine approvals and detailed QC pattern analysis.

#### Scenario: Switch to plate view for review
- **GIVEN** a manager is on the approval queue page
- **WHEN** the manager clicks "Xem theo khay" (View by Plate) toggle
- **THEN** the system displays a list of runsheets with pending approvals
- **AND** clicking a runsheet opens the plate grid in read-only review mode

#### Scenario: Approve results from plate view
- **GIVEN** a manager is viewing a runsheet in plate review mode
- **AND** has selected one or more submitted wells
- **WHEN** the "Phê duyệt" (Approve) action is triggered
- **THEN** the selected results transition to "approved" status
- **AND** the wells display approved status indicator (green border)

#### Scenario: Reject results from plate view
- **GIVEN** a manager is viewing a runsheet in plate review mode
- **AND** has selected one or more submitted wells
- **WHEN** the "Từ chối" (Reject) action is triggered
- **THEN** the system prompts for rejection reason (required)
- **AND** the selected results transition to "retest_required" status
- **AND** the wells display rejected status indicator (red border)

---

### Requirement: Rejection and Retest Workflow

The system SHALL maintain data immutability for rejected results and create linked retest records in compliance with 21 CFR Part 11 requirements.

#### Scenario: Create retest for rejected result
- **GIVEN** a result has status "retest_required"
- **WHEN** an analyst initiates retest from the sample view or plate view
- **THEN** the system creates a NEW result record with:
  - `parent_result_id` linking to original rejected result
  - `retest_reason` field (required)
  - Same sample and assay as original
  - Status "pending"
- **AND** the new result can be assigned to any runsheet well

#### Scenario: View rejection and retest chain
- **GIVEN** a result has been rejected and retested
- **WHEN** a user views the result details
- **THEN** the system displays:
  - Original result with rejection reason and timestamp
  - Linked retest result(s) with retest reason
  - Complete audit trail of status changes
- **AND** original data values are preserved and unmodifiable

---

### Requirement: QC Control Integration with Westgard

The system SHALL route QC control results from runsheet wells to the Westgard IQC system for longitudinal quality monitoring, while keeping blanks and standards plate-specific.

#### Scenario: Assign QC control material to well
- **GIVEN** an analyst is editing a runsheet
- **AND** has selected a well and set type to "Mẫu QC" (Control)
- **WHEN** the analyst selects a registered QC material from the dropdown
- **THEN** the well is linked to the QC material (lot, level)
- **AND** expected value is populated from QC definition

#### Scenario: Enter QC control value
- **GIVEN** a runsheet is in "running" status
- **AND** a well is assigned as QC control with a registered material
- **WHEN** the analyst enters the actual measured value
- **THEN** the system:
  - Stores value in `runsheet_wells`
  - Creates a `qc_results` entry (feeds Westgard evaluation)
  - Evaluates Westgard rules against historical data
  - Displays pass/warning/reject status on well

#### Scenario: QC control blocks plate on Westgard violation
- **GIVEN** a QC control value violates Westgard reject rules (e.g., 1-3s, 2-2s)
- **WHEN** the violation is detected
- **THEN** the system:
  - Marks the well as QC failed (red indicator)
  - Displays the violated rule(s)
  - Optionally blocks runsheet completion pending manager resolution
  - Logs the violation for audit trail

#### Scenario: Blank and standard wells remain plate-specific
- **GIVEN** an analyst assigns blank or standard wells
- **WHEN** values are entered for these wells
- **THEN** the data is stored only in `runsheet_wells`
- **AND** no `qc_results` entries are created
- **AND** validation is plate-specific (blank < threshold, standard calibration)
