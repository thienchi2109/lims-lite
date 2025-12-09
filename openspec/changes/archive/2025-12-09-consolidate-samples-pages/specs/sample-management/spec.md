## ADDED Requirements

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

## Non-Functional Requirements

### NFR 1: Performance
- Initial page load SHALL not exceed 2 seconds on 3G network
- TanStack Query bundle addition SHALL not exceed 30KB gzipped
- Cache invalidation SHALL trigger refetch within 500ms
- Auto-refresh SHALL complete within 1 second for typical datasets (< 100 samples)

### NFR 2: Accessibility
- All role-specific actions SHALL have ARIA labels indicating permission requirements
- Keyboard navigation SHALL work identically for both roles
- Screen reader SHALL announce role-specific permissions ("Manager actions available" / "Analyst view")

### NFR 3: Auditability (21 CFR Part 11)
- All data fetching SHALL respect Supabase RLS policies
- Permissions checks SHALL occur both client and server-side
- Permission violations SHALL be logged to audit_logs table
- Legacy route redirects SHALL preserve audit trail (same session)

### NFR 4: Maintainability
- Single source of truth for samples UI logic
- Component props SHALL use TypeScript interfaces
- Permissions object SHALL be centrally defined
- Code duplication SHALL be eliminated between analyst/manager pages

## Acceptance Criteria

**The consolidation is considered complete when:**

1. ✅ Both analyst and manager can access `/samples` with correct permissions
2. ✅ Legacy routes redirect seamlessly with query preservation
3. ✅ TanStack Query hooks work for both roles
4. ✅ Auto-refresh functions 100% reliably for both roles
5. ✅ All existing features work identically (filters, pagination, sorting)
6. ✅ Role-specific actions are correctly gated by permissions
7. ✅ No TypeScript errors
8. ✅ Production build succeeds
9. ✅ All manual test scenarios pass (analyst + manager)
10. ✅ Code review approved by team lead
