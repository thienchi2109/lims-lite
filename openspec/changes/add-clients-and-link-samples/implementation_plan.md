# Sample Intake UI Implementation Plan

## Goal
Implement a robust "Search-First" client intake workflow in the Sample Accession page, enabling analysts to easily link samples to existing clients or create new ones via manual entry or QR code scanning.

## User Review Required
> [!IMPORTANT]
> **Workflow Confirmation**: This plan implements the "Search-First with Smart QR Integration" workflow.
> - **Phone Number**: Required for new clients (to ensure data quality).
> - **Sample Type**: Defaults to 'Máu' but requires explicit confirmation if changed.
> - **Duplicate Check**: Strict check on (Name + DOB) to prevent duplicates.

### Phone Number Policy
- **New Clients**: **Required**. The field will be marked with an asterisk (*).
- **Existing Clients**: Read-only in the card. If missing (legacy data), a warning icon will appear with a "Update" button.
- **Validation**: Regex check for Vietnamese format `(84|0[3|5|7|8|9])+([0-9]{8})\b`.

### QR Error Handling
- **Scan Failure**: Show a "Toast" notification (Error variant) with "Could not read QR code".
- **Data Mismatch**: If QR data is valid but conflicts with an existing client (same ID, different name), show a "Conflict Dialog" asking the user to verify.
- **Parsing Error**: If QR format is invalid, treat as "Scan Failure".
- **Not Found**: Automatically opens the "Create Client" dialog pre-filled with available data (Name, DOB, Gender, ID).

## Design & UX Specifications (UI/UX Pro Max)

### Visual Style: "Clean Professional Medical"
- **Palette**:
  - Primary: `text-sky-700`, `bg-sky-600` (Trust & Calm)
  - Surface: `bg-white` (Clean), `bg-slate-50` (Subtle contrast)
  - Text: `text-slate-900` (High contrast reading), `text-slate-500` (Muted labels)
  - Border: `border-slate-200` (Subtle separation)
  - Success: `text-emerald-700`, `bg-emerald-50` (Confirmation)
  - Error: `text-red-600`, `bg-red-50` (Alerts)
- **Typography**:
  - Headings: `font-semibold tracking-tight`
  - Body: `text-sm` (Standard), `text-xs uppercase tracking-wider` (Labels)
- **Effects**:
  - Shadows: `shadow-sm` for cards, `shadow-lg` for dropdowns/modals.
  - Transitions: `transition-all duration-200` for hover states.
  - Radius: `rounded-lg` for containers, `rounded-md` for inputs.

### UX Best Practices
- **Validation**:
  - Inline validation on blur (e.g., phone number format).
  - `role="alert"` for error messages.
- **Interaction**:
  - `cursor-pointer` on all interactive elements.
  - Hover states: `hover:bg-slate-50` or `hover:text-sky-800`.
  - Dialog Overlay: `bg-slate-900/50 backdrop-blur-sm`.
  - Dialog Content: `bg-white rounded-xl shadow-2xl border-0`.
  - Form Layout: Grid `grid-cols-2 gap-4`.
- **Validation**: Zod schema matching `CreateClientSchema`.
- **Action**: Calls `upsertClient` server action.
- **Props**: `initialData` (for edit or QR pre-fill), `onSuccess` (callback with new client).

#### [NEW] [sample-type-selector.tsx](file:///d:/lims-lite/src/components/sample-type-selector.tsx)
A simple selector for the 8 allowed sample types.
- **UI**: Full-width `Select` (Dropdown) to fit narrow panel.
- **Default**: 'Máu'.

### 2. Component Updates

#### [MODIFY] [sample-accession-form.tsx](file:///d:/lims-lite/src/components/sample-accession-form.tsx)
- **Remove**: Simple `client_name` input.
- **Add**: `ClientSelector` and `SampleTypeSelector`.
- **State Integration**:
  - Lift `selectedClient` state to form.
  - On submit, pass `client_id` and `client_name` (snapshot) to `createSampleClient`.
- **QR Logic**:
  - Pass `handleQRScan` to `ClientSelector`.
  - On scan: Parse -> `findClientByIdentity`.
    - Found: Auto-select.
    - Not Found: Open `ClientFormDialog` pre-filled with parsed data.

### 3. Server Actions & Types
- Ensure `src/app/actions/clients.ts` is fully wired (already checked, looks good).
- Ensure `CreateSample` type in `src/types/index.ts` supports `client_id` (already checked).

## Workflow Description

1.  **Initial State**:
    - "Client": Empty search box.
    - "Sample Type": Defaults to 'Máu'.

2.  **Scenario A: Existing Client (Manual)**
    - User types "Nguyen Van A".
    - Dropdown shows matches.
    - User selects "Nguyen Van A - 1990".
    - UI shows Client Card (Name, DOB, Phone).

3.  **Scenario B: New Client (Manual)**
    - User types "Tran Van B" -> No results.
    - User clicks "Create new client".
    - Dialog opens -> User fills details -> Save.
    - Dialog closes -> "Tran Van B" is auto-selected.

4.  **Scenario C: QR Scan (Existing)**
    - User clicks "Scan QR".
    - Scans card.
    - System finds match by (Name + DOB).
    - Auto-selects client.

5.  **Scenario D: QR Scan (New)**
    - User clicks "Scan QR".
    - Scans card.
    - System finds NO match.
    - Dialog opens pre-filled with Name, DOB, Gender, ID from QR.
    - User adds Phone (required) -> Save.
    - Auto-selects new client.

## Verification Plan

### Manual Verification
1.  **Search Flow**:
    - Go to `/analyst/accession`.
    - Type a known client name.
    - Verify results appear and selection works.
2.  **Create Flow**:
    - Click "Create new".
    - Fill form with valid phone.
    - Save and verify client is selected.
3.  **QR Flow (Mock)**:
    - Since we can't scan physically, we can mock the `onScan` callback in code temporarily or use the dev tools if available.
    - Trigger scan with payload `123|Test QR|01/01/1990|Nam`.
    - Verify it opens dialog pre-filled.
4.  **Submission**:
    - Create a sample with a selected client.
    - Verify in DB or Samples list that `client_id` is correctly linked.
