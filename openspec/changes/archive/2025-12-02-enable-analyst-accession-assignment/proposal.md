## Why
Analysts need to assign assays/methods immediately when they receive samples, reducing handoffs and letting downstream result entry start without waiting for manager actions. Today only managers can assign tests, forcing double-handling and slowing turnaround.

## What Changes
- Allow analysts to assign tests to samples they received, with server-side role/ownership checks and RLS updates to keep scope limited.
- Add a combined accession + test assignment flow so sample creation and initial assignments happen in one transaction and return the generated `sample_id`.
- Update analyst UI to collect richer sample info and required assays/methods during accession, reusing the assignment UI patterns.

## Impact
- Affected specs: sample-accession (new capability)
- Affected code: Supabase RLS/policies; sample creation + assignment server action; analyst accession page/form and test selection UI components; validation/types for samples and assignments.
