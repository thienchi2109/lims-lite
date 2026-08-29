## Context

The current client registry was introduced before deterministic identity
resolution was defined. Production has 63 client rows, including placeholder
phones, invalid or backfilled identity values, and two duplicate untrusted
identifier groups. The current application has several inconsistent paths:

- `findClientByIdentity` compares trimmed raw name plus exact date of birth.
- `findClientByPhone` compares a trimmed raw phone value.
- `upsertClient` conflicts on raw name plus date of birth and can overwrite
  identity/profile fields.
- QR intake parses CCCD but looks up an existing client by name plus date of
  birth.
- CoA authentication has a separate phone normalization contract.

Issue #111 resolves matching policy; issue #117 resolves lifecycle policy.
This change must establish the shared foundation without implementing the
workbook/parser or atomic bulk-import contracts owned by #112 and #113.

The production database is authoritative and may only be inspected or changed
through SSH to the home server followed by `sudo -n docker exec ... psql`.
Applied migrations are immutable. Every database correction is forward-only,
RLS remains the final authorization boundary, and every mutation is auditable.

## Goals / Non-Goals

**Goals:**

- Represent trusted CCCD and CMND independently from legacy untrusted values.
- Normalize identity inputs deterministically without accent-insensitive
  automatic matching.
- Resolve clients through one transactional server-side contract.
- Return stable machine outcomes and Vietnamese user-facing explanations.
- Replace hard deletion with audited deactivation/restoration.
- Preserve historical identity reservations across inactive clients.
- Give managers an audited path to adjudicate collisions and corrections.
- Remove unsafe automatic identity mutation while preserving unrelated
  application behavior and public contracts.
- Roll out additively with measurable shadow comparison and rollback points.

**Non-Goals:**

- Defining Excel sheets, columns, template versions, or parser behavior.
- Persisting preview state, importing a workbook, or committing a batch.
- Adding assignments to existing samples.
- Changing QR camera, Web Serial, or raw QR parsing transport behavior.
- Replacing CoA authentication or general full-text client search.
- Automatically merging duplicate clients or rewriting historical sample links.
- Treating a manager correction as an electronic signature.

## Decisions

### 1. Store canonical identity separately from legacy display input

Add nullable canonical fields for government identity type/value, normalized
name, and normalized phone while retaining current columns during rollout.
Canonical government identity type is `cccd` or `cmnd`; valid values are exactly
12 or 9 digits respectively. Invalid values, `BACKFILL-*`, and placeholder phone
`0000000000` migrate to an explicit missing/untrusted representation.

Normalization is authoritative in immutable PostgreSQL functions. Resolver RPCs
accept raw schema-validated values and normalize them inside the database; no
caller-normalized value is trusted for matching or locking.

- Name: on the verified PostgreSQL 15.1 runtime, apply `normalize(value, NFC)`,
  trim, collapse `[[:space:]]+` to one ASCII space, then `lower(... COLLATE
  "und-x-icu")`; this preserves Vietnamese diacritics.
- Accent-folded name: candidate/conflict detection only, never automatic match.
- Date of birth: exact date.
- Government identity: digits only plus explicit type validation.
- Phone: canonical Vietnamese `0...` representation with `+84` accepted as
  input; the canonical projection is nullable and placeholder values normalize
  to null. The existing raw phone field remains required for current client
  creation and CoA authentication, which is unchanged by this proposal.

Versioned Vietnamese normalization fixtures cover composed/decomposed accents,
case, and whitespace and must pass before the first migration. Database triggers
maintain canonical projections on every legacy or v2 INSERT/UPDATE so the
additive rollout cannot leave stale derived identity. The legacy raw fields
remain readable during caller migration. Versioned application adapters preserve
existing response shapes while callers move to the canonical contract.

Alternative rejected: continue treating `id_card_num` as an opaque required
string. That preserves placeholders as if they were trusted identities and
cannot distinguish CCCD from CMND.

### 2. Derive active/inactive lifecycle from audited soft-delete fields

Use the repository's soft-delete pattern: `deleted_at`, `deleted_by`, and a
required deletion reason represent inactive state. Restoration clears the
inactive marker through a manager-only RPC that requires a reason and records
the same client UUID in the audit trail.

After the replacement lifecycle/correction workflow passes production smoke,
the same phase uses a separate forward-only gate to remove hard DELETE and
protect lifecycle fields from broad direct UPDATE. Legacy identity updates remain
temporarily available until their mutation callers move atomically to v2;
canonical projections continue to track them. Explicitly allowed non-identity
profile edits remain available through compatible routes. Historical
sample/result links are never rewritten. An inactive client remains visible to
authorized history views but is excluded from new selection and automatic
matching.

Trusted CCCD/CMND reservations apply across active and inactive rows. Phone and
name/date-of-birth collisions involving inactive rows return conflict until a
manager adjudicates the historical identity; they are not silently reused.

Alternative rejected: a separate lifecycle enum plus hard delete. It duplicates
state and violates the project's soft-delete-only rule.

### 3. Resolve and create clients inside one transactional database contract

Introduce additive resolver/RPC v2 contracts. Resolution input contains raw,
schema-validated core identity signals and caller context; the database derives
all canonical keys and does not accept a client UUID selected by an untrusted
client.

The resolver applies this precedence:

1. With a valid typed CCCD/CMND, find candidates by exact type plus value.
   Exactly one active candidate must also agree on normalized name, exact date
   of birth, and supplied normalized phone.
2. Without a valid government identity, exactly one active normalized
   name/date-of-birth candidate may match when supplied phone is absent or
   agrees.
3. Phone never creates a match by itself.
4. Inactive candidates, accent-fold-only candidates, cross-key disagreement,
   duplicate key candidates, or conflicting phone signals fail closed.

An unknown valid CCCD/CMND with no collision signal returns `not_found`; duplicate
exact candidates return `ambiguous`; inactive, accent-only, phone-conflicting,
cross-key, or restricted candidates return `conflict`. Restricted candidates
use a non-disclosing reason, return no client identifier, and prohibit creation.

Only a `not_found` outcome may proceed to creation. Resolution plus creation
uses one transaction. The database derives a sorted advisory-lock set containing
every applicable typed government-identity, normalized name/date-of-birth, and
real normalized-phone key, acquires all locks in deterministic order, then
re-runs resolution. Trusted-key uniqueness is enabled after the cleanup
checkpoint and before v2 mutation cutover; any unique violation is handled by
re-resolving instead of surfacing raw SQL or creating a duplicate.

Address and other mutable profile data are not match keys. A matched request
does not update them; corrections use the manager maintenance path.

Alternative rejected: resolve in application code and then insert separately.
That leaves a race window and allows callers to implement divergent precedence.

### 4. Use four stable outcomes with localized reason mapping

The database returns one machine outcome:

- `matched`
- `not_found`
- `ambiguous`
- `conflict`

Each outcome includes a stable reason code and only the minimal identifiers
needed by an authorized caller. Confidential or otherwise restricted candidates
return a non-disclosing `conflict` reason without a client identifier,
candidate count, or candidate attributes. Application mapping presents:

- `matched`: `Đã khớp`
- `not_found`: `Không tìm thấy khách hàng`
- `ambiguous`: `Không thể xác định duy nhất`
- `conflict`: `Xung đột thông tin`

Messages include an actionable Vietnamese reason and, when supplied by the
future bulk caller, sheet/row/temporary-reference context. Raw PostgreSQL text,
candidate PII lists, and source payloads are never returned or persisted in
audit/error metadata.

Alternative rejected: localize database exception text. Exception wording is
not a stable contract and risks exposing internal or personal data.

### 5. Separate resolution from manager adjudication

Analysts can call resolution through authorized accession workflows but cannot
override `ambiguous` or `conflict`; inactive clients are represented by a stable
`conflict` reason rather than a fifth outcome. Managers receive
separate reason-required RPCs for:

- correcting canonical identity;
- deactivating or restoring a client;
- resolving legacy collision records;
- deliberately releasing a non-government collision guard when policy allows.

Every RPC uses explicit role checks, fixed `search_path`, minimal grants, RLS,
and audit records containing before/after canonical fields and the reason
without PII-rich request payloads.

Alternative rejected: an analyst override flag on the resolver. It would make
the matching contract non-deterministic and bypass the decision boundary.

### 6. Clean data before canonical enforcement

Forward-only migrations first add nullable canonical and lifecycle fields
without changing current callers. A cleanup checkpoint classifies every row and
asserts the observed baseline. Manager adjudication resolves the two known
duplicate untrusted identifier groups before enforcement.

Invalid/backfill identity values and phone placeholders become null/untrusted;
they are not rewritten into plausible identity values. After the checkpoint is
complete and canonical projections are reconciled:

- add uniqueness for non-null typed government identities across all rows;
- add the normalized phone guard selected by the resolved policy;
- add indexes for normalized name/date-of-birth candidate lookup;
- verify the earlier lifecycle direct-mutation and hard-delete guards.

The legacy UNIQUE (`name`, `date_of_birth`) constraint remains only while raw
name/DOB upsert callers depend on it. After every such caller uses v2, a
forward-only migration removes that constraint and prohibits direct identity
UPDATE outside audited manager/v2 contracts. Same-name/DOB clients remain
distinct when stronger identity evidence differs.

Alternative rejected: create unique indexes before cleanup. It would either fail
the migration or encode incorrect legacy values as canonical identities.

### 7. Adopt v2 without regressing existing workflows

The rollout is additive:

1. Add database fields, functions, and manager cleanup support with no caller
   cutover.
2. Deploy resolver/RPC v2 and run read-only shadow comparisons using non-mutating
   legacy and v2 evaluators against the same pre-mutation snapshot.
3. Record aggregate outcome/reason differences without PII. Shadow records may
   contain only caller category, machine outcome/reason, a random request-scoped
   correlation ID, and timestamps under a bounded retention policy; client UUIDs,
   identity hashes/fingerprints, and source coordinates are forbidden.
4. Migrate one workflow at a time behind server-controlled compatibility
   switches. A creation-capable workflow moves lookup, transactional
   resolve/create, and sample mutation together; it cannot expose a v2
   `not_found` decision while still submitting through legacy upsert.
5. Keep current public routes, request/response shapes, scanner transport, QR
   parsing, allowed profile edits, and sample/result behavior compatible
   throughout rollout.
6. Version sample mutations so they lock and revalidate active client state and
   derive the snapshot name in the same transaction.
7. Remove legacy name/DOB uniqueness and block direct identity updates only
   after all raw upsert callers are disabled, observed, switch-rollback tested,
   and same-name/DOB regressions pass. This is the explicit irreversible
   retirement gate for legacy upsert.
8. Retire old mutation behavior only after focused regression, security,
   production smoke, cleanup verification, and rollback rehearsal pass.

The intentional behavior change is that conflicting identity data no longer
silently overwrites an existing client. Scanner transport, QR parsing, sample
creation/linkage, result workflows, and unrelated client search remain
behaviorally unchanged.

### Irreversible Phase 6 rollback boundary

Migration `230_remove_clients_unique_identity.sql` is the irreversible Phase 6
retirement gate. Once applied, switch rollback ends at task 6.10: the
application may no longer recover by re-enabling legacy name/DOB upserts or
direct identity updates.

Any post-gate correction SHALL be delivered as a new forward-only
application/database release with audited manager or resolver contracts. The
name/DOB uniqueness constraint SHALL NOT be restored after valid distinct
clients with the same name and date of birth may exist. The migration changes
schema, grants, comments, and security verification behavior only; it does not
delete, merge, relink, or rewrite client, sample, result, or audit history.

Alternative rejected: a big-bang replacement. It provides no trustworthy way
to distinguish intended matching differences from regressions.

## Risks / Trade-offs

- [Accent preservation can produce a false negative for misspelled names] →
  Detect accent-fold-only candidates as conflict and require adjudication rather
  than accepting a potentially incorrect match.
- [Nullable canonical fields can break legacy UI assumptions] → Keep adapters
  and contract tests until every caller renders missing identity safely.
- [Two concurrent or cross-key not-found requests can create duplicates] →
  Acquire the sorted set of every applicable canonical-key lock, re-resolve
  under lock, enforce trusted-key uniqueness before mutation cutover, and
  re-resolve unique violations.
- [Shadow comparison can leak PII] → Store only aggregate outcomes, reason
  codes, caller category, random request-scoped correlation IDs, and bounded
  timestamps under an explicit retention policy.
- [Removing hard delete changes manager behavior] → Deliver deactivation and
  restoration before revoking the old path, with Vietnamese guidance and audit.
- [Legacy cleanup can relink the wrong history] → Never auto-merge or rewrite
  sample ownership; require manager adjudication and rollback-only verification.
- [A caller migration can regress accession] → Preserve current API shapes,
  test each caller independently, and retain the previous path until production
  smoke proves parity outside intentional conflict handling.

## Migration Plan

1. Establish the non-regressive foundation: capture production aggregates, lock
   legacy contracts with tests, then add nullable canonical identity,
   soft-lifecycle fields, database-maintained projections, versioned
   normalization fixtures, and non-unique indexes.
2. Deliver audited manager-only lifecycle/correction/adjudication RPCs and
   Vietnamese maintenance UI. After production proof, separately revoke hard
   DELETE and broad lifecycle-field UPDATE while preserving legacy identity
   updates, allowed profile edits, and accession behavior.
3. Apply legacy classification first, then adjudicate known collisions; block
   progress until post-adjudication aggregate SQL proves a clean baseline.
4. Deploy localized legacy compatibility handling, then reconcile projections,
   enforce trusted CCCD/CMND uniqueness, and add resolver/RPC v2 with
   database-only normalization, sorted multi-key locks, stable reason codes,
   confidentiality, RLS, grants, and unused typed adapters.
5. Run server-controlled shadow comparison using non-mutating legacy and v2
   evaluators on the same pre-mutation snapshot; require reviewed, PII-free,
   retention-bounded evidence before cutover.
6. Cut over callers behind rollback switches: lookup-only consumers may move
   alone, but each creation-capable manual/QR/accession workflow moves lookup,
   transactional client creation, and locked sample mutation as one unit. After
   all raw upserts are disabled, remove legacy name/DOB uniqueness and block
   direct identity UPDATE.
7. Enable remaining canonical integrity guards at Gate A; observe production
   before retiring proven-unused legacy paths in a separate Gate B deployment.

Rollback before caller cutover disables server-controlled v2 selection and
leaves additive schema in place. Every database guard rollback uses a new
forward-only migration; applied migrations are never edited or rerun. Switch
rollback ends when legacy name/DOB uniqueness is removed because restoring it
may be invalid after same-name/DOB clients are created. Recovery after that gate
uses a new forward-only application/database release. Gate B is independently
deferrable and cannot begin until the post-enforcement observation window proves
the remaining legacy paths unused.

## Open Questions

None. Phase-specific tests define the stable reason-code namespace before its
migration is written; PostgreSQL 15.1 normalization capability and the
multi-key lock strategy are resolved above.
