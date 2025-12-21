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
