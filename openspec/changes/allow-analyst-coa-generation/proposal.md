## Why

Managers currently have exclusive rights to generate Certificates of Analysis (CoAs), creating a workflow bottleneck. After managers approve test results and move samples to `completed` status, they must also manually trigger CoA generation. This duplicates manager effort and delays CoA delivery to clients.

Allowing analysts to generate CoAs for manager-approved samples (status=`completed`) delegates the document generation task while preserving manager authority over approval decisions. This maintains 21 CFR Part 11 compliance (analysts perform work, managers approve/sign) while improving workflow efficiency.

## What Changes

- **MODIFIED**: CoA generation authorization in `generateCoA()` server action (src/app/actions/coa.ts)
  - Change from manager-only to analyst+manager access
  - Add role-specific validation: analysts require `sample.status='completed'` AND all results approved; managers can generate at `review` or `completed` with at least one approved result
  - Add new validation helper function `validateSampleForCoAGeneration()` with comprehensive sample status and results checking

- **NO CHANGE**: CoA regeneration remains manager-only (prevents analysts from overwriting existing CoAs)

- **NO CHANGE**: Database RLS policies already support this (analysts can INSERT into `coa_reports`, only managers can UPDATE)

- **ADDED**: Comprehensive validation logic
  - Sample status validation (strict for analysts, flexible for managers)
  - Results approval validation (all results for analysts, at least one for managers)
  - Clear Vietnamese error messages for each validation failure case

## Impact

- **Affected specs:** reporting (modify CoA Generation requirement)
- **Affected code:**
  - `src/app/actions/coa.ts` lines 699-924: Modify `generateCoA()` authorization and add validation helper (~90 LOC added/modified)
  - `src/app/actions/coa.ts` lines 935-1022: No changes to `regenerateCoA()` (remains manager-only)
  - `src/types/index.ts`: Verify `UserRole` type is exported
- **Security:**
  - Application-level: New validation helper prevents unauthorized CoA generation
  - Database-level: Existing RLS policies already prevent analysts from UPDATE operations
  - Separation of duties: Analysts generate, managers regenerate/amend
  - All CoA operations logged in audit trail with user_id
- **21 CFR Part 11 Compliance:**
  - Maintains signature/record linking (signature_id remains tied to approver, not generator)
  - Audit trail captures both approver (in results) and generator (in coa_reports created_by)
  - Immutable record preservation: analysts cannot regenerate/modify existing CoAs
- **Breaking Changes:** None (purely additive permission expansion)
- **Dependencies:** Requires `add-coa-generation-and-access` to be completed (CoA infrastructure must exist)
- **Performance:** Validation adds 2 additional DB queries (~50ms) but prevents invalid CoA generation attempts
