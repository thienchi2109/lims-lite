## ADDED Requirements

### Requirement: Real-Time Sample List Updates

The system SHALL automatically refresh the sample list when sample data changes, without requiring manual browser refresh.

#### Scenario: Auto-refresh after test assignment
- **GIVEN** a user is viewing the samples page
- **WHEN** they assign tests to a sample
- **THEN** the sample list SHALL automatically refetch and update
- **AND** the assigned sample SHALL appear at the top when sorted by "Ngày cập nhật" DESC
- **AND** the sample status badge SHALL change from "Đã nhận" to "Đã chỉ định" instantly

#### Scenario: Multi-tab synchronization
- **GIVEN** a user has the samples page open in two browser tabs
- **WHEN** they assign tests to a sample in Tab 1
- **AND** they switch focus to Tab 2
- **THEN** Tab 2 SHALL automatically refetch the sample list
- **AND** the updated sample data SHALL be displayed without manual refresh

#### Scenario: Background data freshness
- **GIVEN** a user has the samples page open for 10 minutes
- **WHEN** they switch back to the browser tab
- **THEN** the system SHALL automatically refetch the sample list in the background
- **AND** the UI SHALL update with fresh data if changes occurred

---

### Requirement: Optimistic UI Updates

The system SHALL provide instant visual feedback for mutations before server confirmation.

#### Scenario: Instant status badge update
- **GIVEN** a user is viewing a sample with status "Đã nhận"
- **WHEN** they assign tests to the sample
- **THEN** the status badge SHALL immediately change to "Đã chỉ định"
- **AND** a loading indicator SHALL appear during the mutation
- **AND** the change SHALL persist after server confirmation

#### Scenario: Optimistic update rollback on error
- **GIVEN** a user assigns tests to a sample
- **AND** the optimistic update changes the status to "Đã chỉ định"
- **WHEN** the server returns an error (e.g., network failure)
- **THEN** the status badge SHALL revert to the previous value "Đã nhận"
- **AND** an error toast notification SHALL be displayed
- **AND** the user SHALL be able to retry the operation

---

### Requirement: Intelligent Data Caching

The system SHALL cache sample data in memory to reduce network requests and improve performance.

#### Scenario: Cache hit on navigation
- **GIVEN** a user has viewed the samples page (page 1)
- **WHEN** they navigate to a different page (e.g., Approvals)
- **AND** they navigate back to the samples page within 5 minutes
- **THEN** the system SHALL display cached data instantly
- **AND** the system SHALL refetch data in the background to ensure freshness

#### Scenario: Cache invalidation after mutation
- **GIVEN** a user has cached sample data in memory
- **WHEN** they assign tests to a sample
- **THEN** the system SHALL invalidate all related cache entries
- **AND** the system SHALL refetch fresh data from the server
- **AND** the UI SHALL update with the latest data

#### Scenario: Stale data prevention
- **GIVEN** cached sample data is older than 5 minutes
- **WHEN** a user views the samples page
- **THEN** the system SHALL treat the cache as stale
- **AND** the system SHALL refetch data from the server
- **AND** the UI SHALL display a loading indicator during refetch

---

### Requirement: Query-Based Data Fetching

The system SHALL use TanStack Query (React Query) for all sample data fetching and mutations.

#### Scenario: Samples list query
- **GIVEN** a user navigates to the samples page
- **WHEN** the page loads
- **THEN** the system SHALL execute a query with key `['samples', { filters }]`
- **AND** the query SHALL include pagination, sorting, and filter parameters
- **AND** the system SHALL cache the results for 5 minutes

#### Scenario: Sample detail query
- **GIVEN** a user selects a sample from the list
- **WHEN** the sample detail panel loads
- **THEN** the system SHALL execute a query with key `['sample', sampleId]`
- **AND** the query SHALL fetch the complete sample data
- **AND** the system SHALL cache the result for 5 minutes

#### Scenario: Test assignment mutation
- **GIVEN** a user assigns tests to a sample
- **WHEN** they confirm the assignment
- **THEN** the system SHALL execute a mutation using `useAssignTests` hook
- **AND** the mutation SHALL invalidate `['samples']` and `['sample', sampleId]` queries
- **AND** the system SHALL refetch the invalidated queries automatically

---

### Requirement: Loading and Error States

The system SHALL provide clear visual feedback for loading and error states during data fetching.

#### Scenario: Initial page load
- **GIVEN** a user navigates to the samples page for the first time
- **WHEN** the page is loading data
- **THEN** the system SHALL display a loading skeleton in the sample list
- **AND** the system SHALL display a loading indicator in the sample detail panel
- **AND** the loading indicators SHALL disappear when data is loaded

#### Scenario: Background refetch
- **GIVEN** a user is viewing the samples page with cached data
- **WHEN** the system refetches data in the background
- **THEN** the cached data SHALL remain visible
- **AND** a subtle loading indicator SHALL appear in the header
- **AND** the UI SHALL update seamlessly when new data arrives

#### Scenario: Network error handling
- **GIVEN** a user is viewing the samples page
- **WHEN** a network error occurs during data fetching
- **THEN** the system SHALL display an error message
- **AND** the system SHALL provide a "Retry" button
- **AND** the system SHALL automatically retry the request 3 times before showing the error

---

### Requirement: Filter and Pagination Persistence

The system SHALL maintain filter and pagination state across data refetches.

#### Scenario: Filter preservation after mutation
- **GIVEN** a user has applied filters (status="received", search="ABC")
- **AND** they are on page 2 of the results
- **WHEN** they assign tests to a sample
- **THEN** the system SHALL maintain the current filters
- **AND** the system SHALL maintain the current page number
- **AND** the system SHALL refetch data with the same filter parameters

#### Scenario: URL-based filter synchronization
- **GIVEN** a user changes the status filter to "assigned"
- **WHEN** the URL updates to include `?status=assigned`
- **THEN** the system SHALL automatically refetch data with the new filter
- **AND** the query key SHALL update to `['samples', { status: 'assigned', ... }]`
- **AND** the UI SHALL update with filtered results

---

### Requirement: React Query DevTools Integration

The system SHALL include React Query DevTools in development mode for debugging.

#### Scenario: DevTools availability in development
- **GIVEN** the application is running in development mode
- **WHEN** a developer opens the samples page
- **THEN** the React Query DevTools icon SHALL appear in the bottom-left corner
- **AND** clicking the icon SHALL open the DevTools panel
- **AND** the panel SHALL display all active queries and their cache status

#### Scenario: Query inspection
- **GIVEN** the React Query DevTools panel is open
- **WHEN** a developer selects a query (e.g., `['samples', { page: 1 }]`)
- **THEN** the DevTools SHALL display the query data, status, and cache metadata
- **AND** the developer SHALL be able to manually refetch or invalidate the query
- **AND** the developer SHALL see the query's stale time and cache time

#### Scenario: DevTools disabled in production
- **GIVEN** the application is running in production mode
- **WHEN** a user opens the samples page
- **THEN** the React Query DevTools SHALL NOT be loaded
- **AND** the DevTools code SHALL NOT be included in the production bundle

---

### Requirement: Performance Optimization

The system SHALL optimize network requests and bundle size for efficient performance.

#### Scenario: Request deduplication
- **GIVEN** multiple components request the same sample data simultaneously
- **WHEN** the requests are made within the same render cycle
- **THEN** the system SHALL deduplicate the requests
- **AND** only one network request SHALL be made
- **AND** all components SHALL receive the same cached data

#### Scenario: Bundle size constraint
- **GIVEN** the TanStack Query library is added to the project
- **WHEN** the production bundle is built
- **THEN** the total bundle size SHALL NOT exceed 600KB
- **AND** the TanStack Query library SHALL add no more than 50KB (raw) or 15KB (gzipped)
- **AND** the bundle SHALL be code-split to load TanStack Query only on pages that use it

#### Scenario: Network request reduction
- **GIVEN** a user navigates between pages frequently
- **WHEN** they return to previously visited pages
- **THEN** the system SHALL serve data from cache when possible
- **AND** the number of network requests SHALL be reduced by at least 60% compared to the previous implementation
- **AND** the system SHALL only refetch data when the cache is stale or invalidated
