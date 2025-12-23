## Why
The current Certificate of Analysis (CoA) print template lacks critical patient and sample information required for full compliance and operational context. Additionally, there is no way to input non-database fields like "Referrer" and "Sample Quality" at generation time.

## What Changes
- **Enrich Data Fetching**:
  - Fetch detailed Client info (DOB, Gender, Address, Health Insurance) from `clients` table.
  - Fetch Sample Type from `samples` table.
  - Retrieve "Date of Testing" by querying `audit_logs` for the first transition to `in_progress`.
- **Add Manual Input UI**:
  - Create a dialog in `coa-actions.tsx` to accept "Referrer/Physician" and "Sample Quality" before generation.
  - Pass these stateless inputs to the generation action.
- **Update Print Template**:
  - Expand the HTML template to display all new fields in the "Administrative Information" and "Sample Information" sections.

## Impact
- **Affected Specs**: `coa`
- **Affected Code**:
  - `src/app/actions/coa.ts` (primary generation logic)
  - `src/components/coa-actions.tsx` (UI trigger)
