## Why

Compatibility catalog revision 1 classified 59 active assays as
`not_assignable` only because they had no approved historical results. The
fail-closed assignment rollout therefore hides valid active catalog entries
and prevents users from assigning them, creating a circular state where those
assays can never produce the approved evidence used by the initial review.

## What Changes

- Publish a new immutable compatibility catalog revision that configures every
  currently active assay for the active sample type `LM-000001` (`Máu`).
- Preserve all soft-deleted assay definitions as inactive and exclude them from
  the new compatibility allowlist.
- Validate the expected production baseline before correction and abort
  atomically if the published revision, active sample type, assay counts, or
  compatibility generations have drifted.
- Record the correction through existing catalog revision, review,
  compatibility, content-hash, publication, and audit contracts.
- Keep frontend fail-closed filtering and database assignment enforcement
  unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `assay-sample-type-compatibility`: Add a forward-only recovery requirement
  for correcting active assays that were hidden by an invalid evidence-only
  initial adjudication while preserving soft-delete boundaries.

## Impact

- **Database:** Add one next-numbered forward-only data migration that creates
  and publishes compatibility revision 2 without modifying applied migration
  history.
- **Application/API:** No contract or UI code changes; existing catalog readers
  will consume the new published revision automatically.
- **Compliance/audit:** Preserve revision immutability and audit the system
  correction reason, before/after catalog state, and publication metadata.
- **Security/RLS:** No policy or grant changes. Existing database enforcement
  remains active, and `run_security_tests()` remains mandatory after apply.
- **Localization:** No new UI copy.
