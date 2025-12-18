# search-capability Specification

## Purpose
TBD - created by archiving change add-pg-textsearch-bm25. Update Purpose after archive.
## Requirements
### Requirement: BM25 Full-Text Search Engine

The system SHALL provide BM25-ranked full-text search across LIMS entities using the pg_textsearch extension, delivering relevance-ranked results that account for term frequency saturation and document length normalization.

#### Scenario: Sample search by ID prefix

- **GIVEN** a user with search access
- **WHEN** the user searches for "XL-2024-001"
- **THEN** the system SHALL return samples with matching sample_id prefix
- **AND** results SHALL be ranked by BM25 relevance score
- **AND** exact matches SHALL appear before partial matches

#### Scenario: Sample search by description keywords

- **GIVEN** a user with search access
- **WHEN** the user searches for "blood test urgent"
- **THEN** the system SHALL return samples containing matching keywords
- **AND** samples with more matching terms SHALL rank higher
- **AND** keyword stuffing SHALL not unfairly boost rankings (term frequency saturation)

#### Scenario: Client search by name or contact

- **GIVEN** a user with search access
- **WHEN** the user searches for "Nguyen Clinic"
- **THEN** the system SHALL return clients matching the name or contact fields
- **AND** results SHALL include name, contact_name, phone, email, and address matches

#### Scenario: Assay search by method or specialty

- **GIVEN** a user with search access
- **WHEN** the user searches for "hemoglobin"
- **THEN** the system SHALL return assay definitions matching name, method_name, or description
- **AND** results SHALL be ranked by relevance to the query

#### Scenario: Result search by value or comments

- **GIVEN** a user with search access
- **WHEN** the user searches for "positive culture"
- **THEN** the system SHALL return results matching value or comments fields
- **AND** results SHALL be ranked by BM25 relevance
- **AND** results SHALL respect RLS policies (only approved results visible to analysts)

#### Scenario: Empty query handling

- **GIVEN** a user with search access
- **WHEN** the user submits an empty or whitespace-only search query
- **THEN** the system SHALL return an empty result set without error
- **AND** no database query SHALL be executed for empty queries

#### Scenario: Query length validation

- **GIVEN** a user with search access
- **WHEN** the user submits a query shorter than 2 characters
- **THEN** the system SHALL return an empty result set
- **AND** WHEN the user submits a query longer than 200 characters
- **THEN** the system SHALL truncate the query to 200 characters before searching

### Requirement: Search Index Management

The system SHALL maintain BM25 search indexes on core LIMS tables with configurable parameters for relevance tuning.

#### Scenario: Samples table indexing

- **GIVEN** the pg_textsearch extension is installed
- **WHEN** the search indexes migration runs
- **THEN** the system SHALL create a BM25 index named "samples_search_idx"
- **AND** the index SHALL cover sample_id and description columns
- **AND** the index SHALL use BM25 parameters k1=1.2, b=0.75

#### Scenario: Clients table indexing

- **GIVEN** the pg_textsearch extension is installed
- **WHEN** the search indexes migration runs
- **THEN** the system SHALL create a BM25 index named "clients_search_idx"
- **AND** the index SHALL cover name, contact_name, phone, email, and address columns

#### Scenario: Assays table indexing

- **GIVEN** the pg_textsearch extension is installed
- **WHEN** the search indexes migration runs
- **THEN** the system SHALL create a BM25 index named "assays_search_idx"
- **AND** the index SHALL cover name and description columns

#### Scenario: Audit logs table indexing

- **GIVEN** the pg_textsearch extension is installed
- **WHEN** the search indexes migration runs
- **THEN** the system SHALL create a BM25 index named "audit_logs_search_idx"
- **AND** the index SHALL cover action, old_data, and new_data columns

#### Scenario: Results table indexing

- **GIVEN** the pg_textsearch extension is installed
- **WHEN** the search indexes migration runs
- **THEN** the system SHALL create a BM25 index named "results_search_idx"
- **AND** the index SHALL cover value and comments columns
- **AND** the index SHALL use text_config='english' for mixed content

#### Scenario: Index updates on data changes

- **GIVEN** a BM25 search index exists on a table
- **WHEN** a row is inserted, updated, or deleted
- **THEN** the index SHALL be updated automatically via memtable architecture
- **AND** the updated content SHALL be searchable within 1 second

### Requirement: RLS Policy Compliance

Search results SHALL respect existing Row Level Security policies, ensuring users only see records they are authorized to access.

#### Scenario: Analyst sample search respects RLS

- **GIVEN** an authenticated analyst user
- **WHEN** the analyst searches for samples
- **THEN** the system SHALL only return samples visible per existing RLS policies
- **AND** samples with deleted_at IS NOT NULL SHALL be excluded
- **AND** the search function SHALL use SECURITY INVOKER to inherit caller permissions

#### Scenario: Manager sample search respects RLS

- **GIVEN** an authenticated manager user
- **WHEN** the manager searches for samples
- **THEN** the system SHALL only return samples visible per existing RLS policies
- **AND** the manager SHALL see all non-deleted samples (per manager RLS)

#### Scenario: Unauthenticated search denied

- **GIVEN** an unauthenticated request
- **WHEN** a search function is called
- **THEN** the system SHALL return zero results
- **AND** no error message SHALL reveal database structure

### Requirement: Manager-Only Audit Log Search

Audit log search SHALL be restricted to users with the manager role for compliance and security purposes.

#### Scenario: Manager searches audit logs

- **GIVEN** an authenticated manager user
- **WHEN** the manager calls the search_audit_logs function with query "password change"
- **THEN** the system SHALL return matching audit log entries
- **AND** results SHALL include action, timestamp, user_email, and relevant data fields
- **AND** results SHALL be ranked by BM25 relevance

#### Scenario: Analyst denied audit log search

- **GIVEN** an authenticated analyst user
- **WHEN** the analyst calls the search_audit_logs function
- **THEN** the system SHALL raise an exception with message "Access denied: manager role required"
- **AND** no audit log data SHALL be returned

#### Scenario: Audit log search for compliance investigation

- **GIVEN** an authenticated manager user
- **WHEN** the manager searches for "deleted sample XL-2024-001"
- **THEN** the system SHALL return audit log entries related to the sample deletion
- **AND** results SHALL include the user who performed the action
- **AND** results SHALL include timestamps and before/after data

### Requirement: Global Search Across Entities

The system SHALL provide a unified global search that returns results across all searchable entity types (samples, clients, assays, results) with entity type labeling.

#### Scenario: Global search returns mixed results

- **GIVEN** an authenticated user
- **WHEN** the user performs a global search for "Nguyen"
- **THEN** the system SHALL return results from samples, clients, assays, and results (if matching)
- **AND** each result SHALL include an entity_type field ("sample", "client", "assay", "result")
- **AND** results SHALL be ordered by BM25 score across all entities

#### Scenario: Global search excludes audit logs for analysts

- **GIVEN** an authenticated analyst user
- **WHEN** the analyst performs a global search
- **THEN** the system SHALL NOT include audit log results
- **AND** only samples, clients, assays, and results SHALL be searched

#### Scenario: Global search includes audit logs for managers

- **GIVEN** an authenticated manager user
- **WHEN** the manager performs a global search
- **THEN** the system SHALL include audit log results if matching
- **AND** audit log results SHALL be labeled with entity_type "audit_log"

#### Scenario: Global search result limit

- **GIVEN** an authenticated user
- **WHEN** the user performs a global search with many potential matches
- **THEN** the system SHALL return at most 20 results per entity type by default
- **AND** the total result count per type SHALL be configurable via limit_count parameter

### Requirement: Vietnamese Text Support

The system SHALL support Vietnamese text input and indexing for search queries and indexed content.

#### Scenario: Vietnamese query input

- **GIVEN** an authenticated user
- **WHEN** the user searches for "Benh vien Da khoa"
- **THEN** the system SHALL correctly parse the Vietnamese query
- **AND** return results matching the Vietnamese text
- **AND** diacritics SHALL be handled appropriately (matching with or without)

#### Scenario: Vietnamese content indexing

- **GIVEN** a sample with Vietnamese description "Xet nghiem mau dinh ky"
- **WHEN** a user searches for "mau dinh ky"
- **THEN** the system SHALL return the matching sample
- **AND** word boundaries SHALL be correctly identified

#### Scenario: Mixed language search

- **GIVEN** content containing both Vietnamese and English text
- **WHEN** a user searches with a mixed language query
- **THEN** the system SHALL match against both languages appropriately

### Requirement: Search UI Integration

The system SHALL provide a global search component integrated into the dashboard navigation with keyboard accessibility.

#### Scenario: Search input with debouncing

- **GIVEN** the global search component is visible
- **WHEN** the user types rapidly in the search input
- **THEN** the system SHALL debounce search requests by 300ms
- **AND** only execute search after typing pauses

#### Scenario: Keyboard shortcut activation

- **GIVEN** the user is on any dashboard page
- **WHEN** the user presses Cmd+K (Mac) or Ctrl+K (Windows)
- **THEN** the global search input SHALL receive focus
- **AND** any previous search query SHALL be cleared

#### Scenario: Keyboard navigation in results

- **GIVEN** search results are displayed
- **WHEN** the user presses Arrow Down
- **THEN** the next result item SHALL be highlighted
- **AND** WHEN the user presses Enter
- **THEN** the browser SHALL navigate to the highlighted result's detail page
- **AND** WHEN the user presses Escape
- **THEN** the search results dropdown SHALL close

#### Scenario: Vietnamese UI labels

- **GIVEN** the search UI is rendered
- **THEN** all labels SHALL be in Vietnamese
- **AND** placeholder text SHALL read "Tim kiem..." (Search...)
- **AND** empty results message SHALL read "Khong tim thay ket qua" (No results found)

### Requirement: Search Performance

The system SHALL execute search queries with acceptable latency for interactive use.

#### Scenario: Search response time under load

- **GIVEN** the database contains 10,000 samples
- **WHEN** a user performs a search query
- **THEN** results SHALL be returned within 500ms (p95 latency)

#### Scenario: Concurrent search requests

- **GIVEN** multiple users are searching simultaneously
- **WHEN** 10 concurrent search requests are made
- **THEN** all requests SHALL complete without timeout
- **AND** no request SHALL take longer than 2 seconds

#### Scenario: Index memory efficiency

- **GIVEN** BM25 indexes are created on all searchable tables
- **WHEN** the database is under normal operation
- **THEN** index memory usage SHALL not exceed 100MB for 100,000 total records

### Requirement: Search Error Handling

The system SHALL handle search errors gracefully without exposing internal details.

#### Scenario: Database connection failure

- **GIVEN** a user performs a search
- **WHEN** the database connection fails
- **THEN** the system SHALL return an error message "Tim kiem khong kha dung. Vui long thu lai." (Search unavailable. Please try again.)
- **AND** the error SHALL be logged with full details server-side

#### Scenario: Malformed query handling

- **GIVEN** a user submits a query with special characters
- **WHEN** the query contains SQL injection attempts
- **THEN** the system SHALL sanitize the input before processing
- **AND** the search SHALL execute safely without injection vulnerability

#### Scenario: Extension not available

- **GIVEN** the pg_textsearch extension is not installed
- **WHEN** a search function is called
- **THEN** the system SHALL return an appropriate error
- **AND** the application SHALL not crash

