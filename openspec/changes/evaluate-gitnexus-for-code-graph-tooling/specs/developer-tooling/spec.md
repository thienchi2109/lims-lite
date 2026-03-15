## ADDED Requirements

### Requirement: Windows-compatible graph-assisted code navigation

The engineering workflow SHALL provide graph-assisted code navigation that works in the Windows workspace used by this project for indexed repositories.

#### Scenario: Reference lookup succeeds for an indexed TypeScript symbol

- **GIVEN** `E:\lims-lite` is indexed by the approved graph tool
- **AND** a valid symbol exists in `src/`
- **WHEN** an engineer requests callers or references for that symbol
- **THEN** the tool SHALL return reference results without path-normalization errors
- **AND** the engineer SHALL not need to manually rewrite file paths to make the query succeed

#### Scenario: Definition read succeeds for an indexed file

- **GIVEN** `E:\lims-lite` is indexed by the approved graph tool
- **AND** a valid definition exists in `src/`
- **WHEN** an engineer requests the definition body for that symbol
- **THEN** the tool SHALL return the implementation details for the correct file
- **AND** the workflow SHALL be reliable enough to use during refactor planning

### Requirement: Staged migration for developer graph tooling

The project SHALL adopt replacement graph tooling only after a documented evaluation demonstrates workflow parity and preserves rollback options.

#### Scenario: Candidate tool fails acceptance criteria

- **GIVEN** a replacement graph tool is being evaluated
- **WHEN** the evaluation checklist identifies failures in required workflows
- **THEN** the project SHALL not update default developer instructions to require that tool
- **AND** the failures SHALL be documented with a fallback path

#### Scenario: Candidate tool passes acceptance criteria

- **GIVEN** a replacement graph tool passes the documented Windows evaluation checklist
- **WHEN** maintainers approve migration
- **THEN** `AGENTS.md` and `CLAUDE.md` SHALL be updated to describe the approved workflow
- **AND** rollback guidance SHALL remain documented until the replacement is proven stable in regular use
