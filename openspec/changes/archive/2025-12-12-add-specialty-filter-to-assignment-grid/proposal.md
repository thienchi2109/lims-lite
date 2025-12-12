## Why
Analysts currently assign tests in the accession workflow without a way to narrow the list by “Nhóm xét nghiệm”. As the number of assays grows, this slows down selection and increases the risk of choosing the wrong test. Now that assays are classified by `lab_specialties`, analysts need a fast specialty-based filter during assignment.

## What Changes
- Fetch `lab_specialties` for the analyst accession page and pass them into the Test Assignment Grid.
- Extend the Test Assignment Grid (middle panel) to display a new “Nhóm xét nghiệm” column, showing a color-coded badge consistent with the Manager Assays UI.
- Add a “Nhóm xét nghiệm” dropdown filter in the grid toolbar with “Tất cả nhóm xét nghiệm” as default.
- Send the selected `specialtyId` to `getAssayDefinitions` via client-actions so filtering happens server-side (the server action already supports `specialtyId`).

## Impact
- Affected specs: sample-management
- Affected code: `src/app/(dashboard)/analyst/accession/page.tsx`, `src/components/sample-accession-form.tsx`, `src/components/test-assignment-grid.tsx`, `src/app/actions/assays.ts` (usage), `src/lib/api-client.ts` (params usage)
