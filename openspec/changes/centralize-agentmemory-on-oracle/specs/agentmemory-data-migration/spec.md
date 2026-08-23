## ADDED Requirements

### Requirement: Final preflight inventory
The migration SHALL derive its acceptance set from fresh logical exports taken
during the approved maintenance window rather than from planning-time counts.

#### Scenario: Maintenance window begins
- **WHEN** Codex and OpenCode memory activity is frozen
- **THEN** the operator exports both stores and records versions, counts, memory IDs, file checksums, and export checksums
- **AND** the observed 2026-08-23 baseline of 650 source plus 3 Oracle memories is treated only as a drift comparison

#### Scenario: Maintenance budget is tracked
- **WHEN** the final memory-write freeze begins
- **THEN** the operator records the freeze start timestamp
- **AND** only pre-staged final export, import, comparison, routing, backup, and restore gates run during the freeze
- **AND** the migration rolls back if go-live cannot be declared within the approved 10-minute budget

#### Scenario: Export preflight fails
- **WHEN** either export is malformed, unsupported, incomplete, or cannot be checksummed
- **THEN** migration stops before the fresh canonical store accepts writes
- **AND** both existing stores remain available for rollback

### Requirement: Collision-safe merge
The migration MUST preserve the exact union of source and Oracle memories
without silently overwriting divergent records that share an ID.

#### Scenario: Memory ID sets do not overlap
- **WHEN** the final source and Oracle ID sets are disjoint
- **THEN** the Oracle export is imported into the empty canonical store
- **AND** the source export is merged afterward

#### Scenario: Identical memory IDs overlap
- **WHEN** an ID exists in both exports with byte-equivalent normalized records
- **THEN** the verifier may count the record once in the expected union
- **AND** the migration records the deduplication in its evidence

#### Scenario: Divergent memory IDs overlap
- **WHEN** an ID exists in both exports with different normalized records
- **THEN** migration aborts before import
- **AND** no automatic winner is selected

### Requirement: Metadata-preserving logical import
The canonical import SHALL preserve memory identity and durable metadata
supported by the versioned export contract.

#### Scenario: Standalone export is normalized
- **WHEN** the final standalone export omits server-required summary and observation categories
- **THEN** preflight proves the corresponding source categories are empty
- **AND** normalization adds explicit empty defaults without changing any memory or session record
- **AND** raw and normalized artifacts receive separate checksums

#### Scenario: Source memory is imported
- **WHEN** a source memory is present in the final `0.9.21` export
- **THEN** the canonical record retains its ID, type, content, concepts, files, creation and update timestamps, strength, version, latest marker, and session associations

#### Scenario: Oracle memory is imported
- **WHEN** an Oracle memory is present in the final `0.9.29` export
- **THEN** the canonical record retains its ID and supported metadata
- **AND** any exported access-log record associated with that memory is retained

### Requirement: Exact migration verification
The migration SHALL remain incomplete until the canonical store matches the
expected final union and passes persistence and client-path tests.

#### Scenario: Imported ID set is checked
- **WHEN** both imports complete
- **THEN** the canonical memory ID set equals the calculated union of the two final exports
- **AND** no expected ID is missing
- **AND** no unexplained ID is present

#### Scenario: Imported records are compared
- **WHEN** the canonical export is compared with the two final import artifacts
- **THEN** every imported durable record matches its normalized source record field by field
- **AND** every exported access-log record and every record in another non-empty logical category matches its normalized source record field by field
- **AND** each imported logical category preserves its expected record count
- **AND** controlled post-import verification records are excluded from the imported-data comparison and recorded separately

#### Scenario: Canonical services restart
- **WHEN** the engine and worker are restarted after import
- **THEN** the same verified memory ID set remains present
- **AND** representative source and Oracle memories are recallable

#### Scenario: Client cutover is tested
- **WHEN** OpenCode and Codex are switched to the canonical path
- **THEN** cross-client save and recall tests pass
- **AND** an intentional tunnel outage proves fail-closed behavior

#### Scenario: Final go-live is declared
- **WHEN** record comparison, restart persistence, cross-client routing, fail-closed outage, nightly backup, and temporary restore gates all pass
- **THEN** the operator records the freeze end and go-live timestamps
- **AND** declares Oracle the writable authority
- **AND** reopens normal memory writes

### Requirement: Rollback preservation
The migration SHALL keep both prior stores and their logical exports unchanged
until canonical operation and backup retention have been established.

#### Scenario: Post-import verification fails
- **WHEN** any ID, field comparison, access-log, recall, restart, routing, fail-closed, backup, restore, or maintenance-budget check fails
- **THEN** the canonical cutover is declared unsuccessful
- **AND** the new services are stopped
- **AND** the prior Oracle runtime can restart against its untouched store

#### Scenario: Migration succeeds
- **WHEN** all go/no-go checks pass
- **THEN** the previous standalone and Oracle stores are archived read-only
- **AND** rollback artifacts are retained until the first verified monthly backup generation exists
