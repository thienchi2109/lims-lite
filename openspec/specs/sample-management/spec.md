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

