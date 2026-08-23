## Context

Compatibility revision 1 is the only published catalog on production. It
contains 84 active assays for the only active sample type, `LM-000001`
(`Máu`), but only 25 assays are `configured`; 59 active assays were reviewed as
`not_assignable` because their historical results were not approved. The
frontend and database correctly enforce that published allowlist, so correcting
availability requires a new catalog revision rather than a UI fallback.

The catalog already provides audited manager-only RPCs to clone, update,
review, and publish a revision. Production also has an active system manager
actor with UUID `00000000-0000-0000-0000-000000000000`, which published
revision 1 and can represent this explicitly authorized system correction.

## Goals / Non-Goals

**Goals:**

- Restore assignment availability for all 59 active assays hidden by the
  evidence-only revision 1 adjudication.
- Configure every active assay for the active `Máu` sample type in revision 2.
- Preserve soft-deleted assays as inactive and absent from the allowlist.
- Reuse existing catalog RPCs, guards, hashes, publication transitions, and
  audit triggers.
- Abort atomically if production state no longer matches the reviewed baseline.

**Non-Goals:**

- Do not restore or mutate soft-deleted assay definitions.
- Do not remove fail-closed frontend filtering or database enforcement.
- Do not change RLS policies, grants, RPC signatures, or application code.
- Do not generalize future assay compatibility decisions to every sample type.

## Decisions

### Use a forward-only data migration

Migration 229 will create revision 2 through the existing catalog RPC workflow.
Applied migrations 206-213 remain byte-for-byte unchanged. Any later correction
must create revision 3 or higher.

**Alternative considered:** Directly update revision 1. Rejected because
published revisions are immutable and direct mutation would violate the audit
contract.

### Reuse the system manager actor and catalog RPCs

The migration will set transaction-local JWT claims for the existing system
manager actor, clone revision 1, update only the 59 active `not_assignable`
reviews to `configured`, review the draft hash, and publish revision 2.
Candidate rows for `Máu` will be accepted through the same update RPC; assays
without a candidate would use the RPC's manual provenance path.

**Alternative considered:** Insert revision, review, and allowlist rows directly.
Rejected because it would duplicate RPC invariants and weaken confidence in
audit attribution and publication consistency.

### Bind the correction to the reviewed production baseline

The migration will assert:

- revision 1 is the only published revision and no draft exists;
- `LM-000001` is the only active sample type;
- exactly 84 assays are active;
- exactly 25 active assays are configured and 59 are `not_assignable`;
- review and compatibility generations are current;
- the system manager actor exists, is active, and has role `manager`.

Any mismatch aborts the transaction before revision 2 is created.

### Verify lifecycle boundaries after publication

Postconditions will require revision 2 to expose 84 current allowlist pairs for
`Máu`, with all 84 active assays configured, zero active `not_assignable`
reviews, and zero allowlist pairs referencing soft-deleted assays.

## Risks / Trade-offs

- **Production baseline changes before apply** -> Abort with a specific
  exception and re-survey rather than partially correcting a changed catalog.
- **System actor is mistaken for human clinical review** -> Use explicit
  creation, review, candidate-decision, and publish reasons that identify this
  as an authorized availability recovery.
- **A soft-deleted assay is accidentally restored** -> Filter every correction
  update by `assay_definitions.deleted_at IS NULL` and enforce a zero-row
  postcondition for deleted assay mappings.
- **Publishing all active assays for `Máu` is broader than historical evidence**
  -> This is the user's explicit operational decision; the migration limits the
  change to the one currently active sample type and does not establish a
  future automatic rule.

## Migration Plan

1. Commit and deploy migration 229 to `/opt/lims-lite`.
2. Apply it through `sudo -n docker exec -i lims-postgres psql` with
   `ON_ERROR_STOP=1`.
3. Run `run_security_tests()`.
4. Query revision status, configured/allowlist counts, deleted-assay leakage,
   and the four reported assay codes.
5. Smoke the production accession UI.

Rollback is forward-only: if revision 2 is incorrect, create and publish a new
revision 3. Never edit or re-run migration 229 after it reaches a persistent
database.

## Open Questions

None.
