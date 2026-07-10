# sample-management Specification

## Purpose
TBD - created by archiving change consolidate-samples-pages. Update Purpose after archive.
## Requirements
### Requirement: Unified samples workspace with role-aware permissions

The system SHALL provide a unified samples workspace at `/samples` that:
- Authenticates users and determines role server-side
- Uses TanStack Query for client-side data fetching (both roles)
- Enforces role-specific permissions for actions
- Redirects legacy routes (`/analyst/samples`, `/manager/samples`) transparently

**Context:** Currently, manager samples page uses TanStack Query (migrated Dec 7, 2025), while analyst samples page still uses legacy server-side rendering. This creates maintenance burden and feature parity gaps.

**Objective:** Create a single `/samples` workspace that serves both analyst and manager roles with TanStack Query-based data fetching and role-specific permissions.

#### Scenario: Analyst accesses unified workspace

**GIVEN** an authenticated user with analyst role  
**WHEN** the user navigates to `/analyst/samples` or `/samples`  
**THEN** the system SHALL:
- Redirect from `/analyst/samples` to `/samples` preserving query parameters
- Load the samples list via `useSamples` TanStack Query hook
- Load sample detail via `useSampleDetail` TanStack Query hook
- Display filters: search, status, date range, sort, pagination
- Enable actions: Edit (status=received), Enter Results (status=assigned/in_progress)
- Hide manager-only actions: Reject, Ignore
- Show back link to `/analyst` dashboard
- Auto-refresh data on mutations without manual browser refresh

#### Scenario: Manager accesses unified workspace

**GIVEN** an authenticated user with manager role  
**WHEN** the user navigates to `/manager/samples` or `/samples`  
**THEN** the system SHALL:
- Redirect from `/manager/samples` to `/samples` preserving query parameters
- Load the samples list via `useSamples` TanStack Query hook
- Load sample detail via `useSampleDetail` TanStack Query hook
- Display filters: search, status, date range, receiver, sort, pagination
- Enable actions: View Results (all statuses), Reject/Ignore (status=received/assigned)
- Hide analyst-only actions: Enter Results
- Show back link to `/manager` dashboard
- Auto-refresh data on mutations without manual browser refresh

#### Scenario: Permissions enforcement

**GIVEN** the unified `/samples` workspace is loaded  
**WHEN** actions are rendered based on user role  
**THEN** the system SHALL:
- Build permissions object server-side based on authenticated user role
- Pass permissions to `SamplesPageClient` as prop
- Gate UI actions by permissions (not route path)
- Enforce permissions server-side via RLS policies (defense in depth)
- Log any permission violations for audit trail

#### Scenario: Legacy route redirection

**GIVEN** a user with bookmarked URL to `/analyst/samples?page=2&status=received`  
**WHEN** the user opens the bookmark  
**THEN** the system SHALL:
- Authenticate user and verify role
- Redirect to `/samples?page=2&status=received` (query preserved)
- Load page with same filters and pagination state
- Maintain user context without data loss

#### Scenario: Auto-refresh after mutation

**GIVEN** a user has assigned tests to a sample  
**WHEN** the assignment completes successfully  
**THEN** the system SHALL:
- Invalidate TanStack Query cache for samples list
- Automatically refetch fresh data
- Navigate to page 1 of samples list
- Sort by `updated_at` DESC to show recently modified sample at top
- Update status badge in detail panel without manual refresh
- All behavior consistent for both analyst and manager roles

#### Scenario: Data consistency across tabs

**GIVEN** a user has `/samples` open in two browser tabs  
**WHEN** the user performs an action in Tab A that modifies a sample  
**AND** switches focus to Tab B  
**THEN** the system SHALL:
- Trigger window focus refetch in Tab B (TanStack Query default behavior)
- Update Tab B with latest data from server
- Synchronize sample list and detail panels
- Show consistent state across all tabs

### Requirement: Analyst can filter assays by specialty during assignment

The system SHALL allow analysts to quickly filter available assay definitions by “Nhóm xét nghiệm” when assigning tests in the accession workflow.

#### Scenario: Analyst filters tests by specialty

- **GIVEN** an authenticated analyst is on `/analyst/accession` and viewing the Test Assignment Grid  
- **WHEN** the analyst selects a specific specialty from the “Nhóm xét nghiệm” filter  
- **THEN** the grid SHALL request assays filtered server-side by that specialty  
- **AND** only assays linked to the selected specialty SHALL be displayed  
- **AND** the specialty badge SHALL be shown per assay row  
- **AND** any tests already selected SHALL remain selected even if they are not visible under the filter.

#### Scenario: Analyst clears the specialty filter

- **GIVEN** the “Nhóm xét nghiệm” filter is set to a specific specialty  
- **WHEN** the analyst selects “Tất cả nhóm xét nghiệm”  
- **THEN** the grid SHALL display assays from all specialties (including assays with no specialty).

### Requirement: Manager approval queue tab switching SHALL use cached TanStack Query state

The system SHALL load manager approval queue rows for `review` and `completed` through TanStack Query query keys that include the active tab, so switching tabs can reuse cached data instead of forcing a full route refresh for the queue list.

#### Scenario: Switching back to a previously loaded tab reuses cached rows

- **WHEN** a manager has already loaded both approval queue tabs in the current session
- **THEN** switching back to a previously viewed tab SHALL render cached rows immediately
- **AND** the system SHALL allow a background refetch without blanking the queue list
- **AND** the tab switch SHALL NOT depend on a full server route navigation just to show the list for the target tab

#### Scenario: The opposite tab is prefetched on likely intent

- **WHEN** a manager lands on the approval queue or signals intent to open the opposite tab
- **THEN** the system SHALL prefetch the opposite tab queue using a distinct approval queue query key
- **AND** the next tab switch SHALL reuse that prefetched data when it is still fresh

#### Scenario: Deep-link tab state survives hydration and refresh

- **WHEN** a manager opens `/manager/approvals?tab=completed` directly or refreshes that URL
- **THEN** the system SHALL hydrate the `completed` queue on initial load
- **AND** subsequent client-side tab switches SHALL keep the `tab` query parameter synchronized with the active tab

#### Scenario: Switching tabs clears stale sample selection

- **WHEN** a manager switches to a different approval tab and the current `sampleId` does not exist in that tab's queue
- **THEN** the system SHALL clear `sampleId` from the URL
- **AND** the system SHALL clear the related detail state instead of keeping a sample outside the active queue
- **AND** desktop and mobile SHALL apply the same rule

#### Scenario: Desktop and mobile preserve the same tab semantics

- **WHEN** a manager switches approval queue tabs on desktop or mobile breakpoint
- **THEN** the system SHALL apply the same rules for URL synchronization, cached queue reuse, and empty/error states
- **AND** breakpoint changes SHALL NOT introduce a different tab selection contract for the same URL

#### Scenario: Hidden layout does not duplicate queue side effects

- **WHEN** the approval page renders responsive desktop/mobile layouts around the same URL
- **THEN** only the viewport-active queue owner SHALL drive approval queue query, prefetch, and tab URL synchronization side effects
- **AND** hidden layouts SHALL NOT trigger duplicate fetch/prefetch behavior for the same tab switch

#### Scenario: Fetch failure is isolated to the active tab

- **WHEN** loading the active approval tab fails
- **THEN** the system SHALL show a Vietnamese error state for that tab
- **AND** the system SHALL preserve cached rows for the other tab until that tab is opened

### Requirement: Authorized users can filter Samples to confidential-associated samples

The Samples workspace SHALL provide an explicit confidential-only list filter for users whose authenticated dashboard session has `canAccessConfidential = true`.

#### Scenario: Authorized user sees confidential filter control

- **GIVEN** an authenticated analyst or manager has `canAccessConfidential = true`
- **WHEN** the user opens the Samples workspace
- **THEN** the filter toolbar SHALL render a control labeled "Mẫu nhạy cảm"
- **AND** the control SHALL be available alongside existing scope, sort, page-size, and advanced filter controls.

#### Scenario: Authorized user enables confidential-only filtering

- **GIVEN** an authenticated analyst or manager has `canAccessConfidential = true`
- **WHEN** the user enables the "Mẫu nhạy cảm" filter
- **THEN** the URL SHALL represent the confidential-only state
- **AND** the Samples query SHALL request only samples that contain at least one result linked to a confidential assay
- **AND** pagination totals SHALL be calculated from that confidential-only row set.

#### Scenario: Confidential-only filter preserves active sample default

- **GIVEN** an authenticated user has `canAccessConfidential = true`
- **AND** no explicit `scope=all` or `status` filter is selected
- **WHEN** the user enables the "Mẫu nhạy cảm" filter
- **THEN** completed samples SHALL remain hidden by the existing active-scope default
- **AND** only active confidential-associated samples SHALL be returned.

#### Scenario: Authorized user combines confidential-only with all-scope filtering

- **GIVEN** an authenticated user has `canAccessConfidential = true`
- **WHEN** the user enables both "Mẫu nhạy cảm" and "Hiển thị tất cả"
- **THEN** the Samples list SHALL include confidential-associated samples across all statuses allowed by the remaining filters
- **AND** non-confidential samples SHALL be excluded.

### Requirement: Unauthorized users cannot discover confidential-associated samples through the confidential-only filter

The Samples workspace and Samples list query SHALL keep confidential-associated samples non-discoverable for users whose authenticated session does not have confidential access.

#### Scenario: Unauthorized user does not see confidential filter control

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user opens the Samples workspace
- **THEN** the filter toolbar SHALL NOT render the "Mẫu nhạy cảm" control.

#### Scenario: Unauthorized URL tampering returns no confidential rows or counts

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user manually opens a Samples URL with the confidential-only query state
- **THEN** the Samples list query SHALL return no confidential-associated rows
- **AND** the returned total count SHALL NOT reveal the number of confidential-associated samples.

#### Scenario: Unauthorized default list remains non-discoverable

- **GIVEN** an authenticated user has `canAccessConfidential = false`
- **WHEN** the user opens the Samples workspace without the confidential-only query state
- **THEN** confidential-associated samples SHALL remain absent from rows and totals
- **AND** all existing non-confidential Samples filters SHALL continue to work.

### Requirement: Confidential-only Samples filtering is enforced server-side

The system SHALL enforce confidential-only Samples filtering inside the database-backed list path before counting, sorting, and pagination.

#### Scenario: Confidential-only query uses database predicate

- **WHEN** the Samples list is requested with confidential-only filtering enabled
- **THEN** `get_samples_page` SHALL apply the confidential-associated-sample predicate before computing `total_count`
- **AND** the application SHALL NOT rely on client-side filtering or post-pagination filtering to remove non-confidential rows.

#### Scenario: Normal and confidential-only list states use separate cache identities

- **WHEN** a user toggles the "Mẫu nhạy cảm" filter
- **THEN** the Samples query key SHALL distinguish confidential-only results from normal Samples results
- **AND** previously cached normal-list rows SHALL NOT be reused as the confidential-only list payload.

