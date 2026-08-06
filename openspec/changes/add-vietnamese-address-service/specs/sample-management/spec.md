## ADDED Requirements

### Requirement: CCCD scanning remains the primary entry path

Address autocomplete SHALL be secondary to successful CCCD scanning and SHALL
not delay or overwrite newer scanner-owned form state.

#### Scenario: CCCD scan succeeds

- **WHEN** a valid supported scan supplies client data
- **THEN** the scan SHALL populate the draft through the existing flow
- **AND** stale autocomplete work SHALL not overwrite the scanned address

#### Scenario: Scanner is unavailable

- **WHEN** scanning is unavailable or fails
- **THEN** the analyst SHALL still be able to use autocomplete or manual entry

### Requirement: Existing client address persistence is preserved

The integration SHALL use the existing client address field and existing
authorized mutation. It SHALL not add structured-address columns or change
current client audit and RLS controls.

#### Scenario: Suggested address is saved

- **WHEN** an analyst selects a suggestion and saves a valid client
- **THEN** the formatted text SHALL be persisted in the existing address field
- **AND** existing authorization, RLS, and audit behavior SHALL apply

#### Scenario: Manual address is saved

- **WHEN** the analyst enters address text manually
- **THEN** the existing mutation SHALL accept it under current validation and
  authorization rules

### Requirement: Address-service failure does not block accession

Client creation and sample accession SHALL remain available when the address
service or Tailscale path is unavailable.

#### Scenario: Lookup fails

- **WHEN** the service times out, is unreachable, is not ready, or returns an
  invalid payload
- **THEN** the form SHALL preserve current user input and allow manual entry
- **AND** the analyst SHALL still be able to continue when existing required
  fields are valid

#### Scenario: Service recovers

- **WHEN** a later lookup succeeds
- **THEN** suggestions MAY resume
- **AND** SHALL not replace text already owned by a newer scan or user edit
