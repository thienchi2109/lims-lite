# Phase 3 Production Evidence

Date: 2026-08-22

## Scope and immutable artifacts

- Phase 3 started from `main` at
  `b62f70068d7296870884a096213df342bb6797ee`.
- Classification migration
  `220_classify_legacy_client_identity.sql` was committed at `3143823` before
  production apply. Its immutable SHA-256 checksum is
  `c5431a6f0b03324feba8bd52bd65f10d829a2da1022b56d97e7ca973cc472a7a`.
- The bounded adjudication script was committed at `fd298cf` before use. Its
  SHA-256 checksum is
  `fe5362573e7d08004bbdba84a9452a91e1b03a9728b9973f3776859adcbb380e`.
- Migrations 215-219 remained byte-for-byte unchanged. Phase 4, Issue #126,
  deterministic resolver behavior, uniqueness enforcement, merge behavior,
  UUID replacement, and sample/history relinking were not implemented.

## Classification and reconciliation

- The committed migration was first rehearsed in a transaction and updated 63
  rows before ending in `ROLLBACK`.
- The same committed migration then applied through the approved home-server
  SSH and Docker path, updating 63 rows and ending in `COMMIT`.
- Production aggregate after classification:
  - clients: 63
  - trusted CCCD projections: 20
  - trusted CMND projections: 1
  - intentionally untrusted government identities: 42
  - null canonical phones: 27
  - null canonical names: 0
  - projection mismatches: 0
  - migration audit rows: 63
  - sample links: 97
- Client UUIDs, raw identity/profile evidence, lifecycle state, RLS/grants, and
  all 97 sample links were unchanged by classification.

## Checkpoint and adjudication

- The pre-adjudication aggregate checkpoint found four unresolved pairs across
  two legacy identifier groups with group sizes two and three.
- The committed adjudication script was rehearsed and ended in `ROLLBACK` with:

```json
{"adjudicated_groups":2,"adjudicated_pairs":4,"remaining_unresolved_pairs":0}
```

- The same two groups were then adjudicated through the Phase 2 manager-only
  RPC as `confirmed_distinct`. The committed result was four adjudication rows
  and four `CLIENT_COLLISION_ADJUDICATED` audit rows.
- The final aggregate checkpoint reported zero unresolved pairs and ended in
  `ROLLBACK`.
- Adjudication did not mutate client rows, merge clients, replace UUIDs, or
  relink samples/history.

## Verification

- TDD migration contract: RED observed before implementation; 7/7 tests passed
  after implementation.
- Production rollback SQL passed.
- `run_security_tests()` passed 35/35 after migration and again after
  adjudication.
- Projection reconciliation passed with zero mismatches.
- Focused client/profile/accession Vitest passed 119/119 across 24 files.
- Focused profile and client-edit Node regression suites passed.
- Typecheck and `check:no-explicit-any` passed.
- Lint completed with zero errors and 80 pre-existing warnings.
- React Doctor completed with 358 warnings across 138 of 784 files.
- OpenSpec strict validation passed.
- Production manager browser smoke passed through real OTP, rendered the
  Vietnamese lifecycle workspace, and showed `Cần xử lý 0`.
- Production profile rendered for the manager. A fresh analyst session was
  redirected from `/manager/clients` to `/analyst`, and the analyst accession
  page rendered without submitting a mutation.
- Production root, public CoA access, and auth health HTTP smoke passed.

## Gaps and residual risks

- Collision discovery remains O(n^2). Issue #126 tracks that performance work
  and was intentionally excluded from Phase 3.
- Forty-two raw government identifiers remain intentionally untrusted,
  including 25 `BACKFILL-*` values. No replacement identity was invented.
- Twenty-seven placeholder or invalid phones remain in raw fields for legacy
  compatibility and canonicalize to null.
- The production `postgres` role is intentionally non-superuser. It cannot set
  `temp_file_limit`; the Phase 3 rollback SQL therefore retains statement,
  lock, and parallel limits without requiring a privilege escalation.
