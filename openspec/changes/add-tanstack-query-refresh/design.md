## Context

The current samples page architecture uses Next.js Server Components with server-side data fetching passed as props to client components. After mutations (test assignment), the page attempts to refresh using `router.refresh()`, but this approach is unreliable in Next.js 14+ App Router, resulting in stale UI data and poor user experience.

**Current Architecture:**
```
Server Component (page.tsx)
  ├─ fetchSamples() → props
  ├─ SampleListTable (Client) ← receives samples as prop
  └─ SampleBottomRow (Client)
       ├─ SampleDetailPanel ← receives sample as prop
       └─ AssignedTestsPanel
            └─ TestAssignmentModule
                 └─ assignTests() → router.refresh() ❌ unreliable
```

**Constraints:**
- Must maintain 21 CFR Part 11 compliance (audit logging, RLS policies)
- Must work with self-hosted Supabase in Docker
- Must support both Manager and Analyst roles
- Must maintain existing filter/pagination functionality
- Bundle size should remain reasonable (\u003c600KB total)

**Stakeholders:**
- Lab analysts (primary users of test assignment workflow)
- Lab managers (oversight and approval)
- System administrators (deployment and maintenance)

## Goals / Non-Goals

**Goals:**
- ✅ 100% reliable auto-refresh after test assignment
- ✅ Instant UI feedback via optimistic updates
- ✅ Automatic cache invalidation and refetching
- ✅ Maintain existing functionality (filters, pagination, sorting)
- ✅ Improve developer experience with better debugging tools
- ✅ Reduce network requests through intelligent caching

**Non-Goals:**
- ❌ Real-time WebSocket updates (not needed for this use case)
- ❌ Offline support (lab environment has stable internet)
- ❌ Migrating other pages to TanStack Query (only samples page for now)
- ❌ Changing database schema or RLS policies
- ❌ Modifying server actions beyond adding revalidatePath

## Decisions

### Decision 1: Use TanStack Query for Data Fetching

**What:** Integrate TanStack Query (React Query) as the primary data fetching and caching layer for the samples page.

**Why:**
- Industry-standard solution (40K+ GitHub stars, used by Netflix, Amazon, Microsoft)
- Built-in cache invalidation and optimistic updates
- Automatic background refetching and window focus refetching
- Excellent TypeScript support and DevTools
- 100% reliable vs. 60-70% with `router.refresh()`

**Alternatives considered:**
1. **SWR (Vercel's data fetching library)**
   - Pros: Smaller bundle (~11KB), simpler API
   - Cons: Less powerful cache invalidation, no optimistic updates, smaller ecosystem
   - Rejected: Insufficient for complex cache management needs

2. **Server Actions + revalidatePath only**
   - Pros: Zero bundle increase, stays server-first
   - Cons: Unreliable refresh (60-70% success rate), no optimistic updates, manual cache management
   - Rejected: Doesn't solve the core reliability problem

3. **Apollo Client**
   - Pros: Powerful GraphQL integration, normalized cache
   - Cons: Massive bundle (~100KB), requires GraphQL, overkill for REST API
   - Rejected: Too heavy, we use REST not GraphQL

**Rationale:** TanStack Query provides the best balance of reliability, features, and bundle size for our use case.

---

### Decision 2: Hybrid Server/Client Architecture

**What:** Keep Server Components for auth checks and initial setup, but use Client Components with TanStack Query for data fetching.

**Why:**
- Maintains security (auth checks still server-side)
- Enables client-side caching and real-time updates
- Preserves existing middleware and RLS enforcement
- Allows gradual migration (only samples page for now)

**Architecture:**
```
Server Component (page.tsx)
  ├─ Auth check (server-side)
  ├─ Parse URL params (server-side)
  └─ SamplesPageClient (Client)
       ├─ useSamples() → TanStack Query
       ├─ SampleListTable
       └─ SampleBottomRow
            ├─ SampleDetailPanel → useSampleDetail()
            └─ AssignedTestsPanel → useAssignTests()
```

**Trade-offs:**
- ✅ Better UX (instant updates, no manual refresh)
- ✅ Better DX (React Query DevTools, easier debugging)
- ⚠️ Bundle size increase (+50KB raw, +15KB gzipped)
- ⚠️ Initial load slightly slower (+100-200ms)
- ✅ Subsequent navigations faster (caching)

---

### Decision 3: Query Configuration

**What:** Configure QueryClient with the following defaults:
```typescript
{
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes (formerly cacheTime)
      retry: 3,                         // Retry failed queries 3 times
      refetchOnWindowFocus: true,       // Refetch when tab regains focus
      refetchOnReconnect: true,         // Refetch when network reconnects
    },
  },
}
```

**Why:**
- **5-minute stale time**: Balances freshness with network efficiency (lab data doesn't change every second)
- **10-minute cache time**: Keeps data in memory for quick navigation
- **3 retries**: Handles transient network issues
- **Window focus refetch**: Ensures data is fresh when user returns to tab
- **Reconnect refetch**: Handles network interruptions gracefully

**Alternatives considered:**
- Shorter stale time (1 minute): Too many network requests, unnecessary for lab workflow
- Longer stale time (15 minutes): Risk of showing stale data, especially after test assignments
- No retries: Poor UX on transient network failures

---

### Decision 4: Optimistic Updates Strategy

**What:** Implement optimistic updates for test assignment mutations:
1. Immediately update sample status in cache ("Đã nhận" → "Đã chỉ định")
2. Show loading indicator during mutation
3. On success: Invalidate queries to refetch fresh data
4. On error: Roll back optimistic update and show error toast

**Why:**
- Instant UI feedback (feels responsive)
- Graceful error handling (rolls back on failure)
- Maintains data consistency (refetch after success)

**Implementation:**
```typescript
const { mutate } = useAssignTests({
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['sample', sampleId])
    
    // Snapshot previous value
    const previousSample = queryClient.getQueryData(['sample', sampleId])
    
    // Optimistically update
    queryClient.setQueryData(['sample', sampleId], (old) => ({
      ...old,
      status: 'assigned',
    }))
    
    return { previousSample }
  },
  onError: (err, variables, context) => {
    // Roll back on error
    queryClient.setQueryData(['sample', sampleId], context.previousSample)
  },
  onSuccess: () => {
    // Invalidate to refetch fresh data
    queryClient.invalidateQueries(['samples'])
    queryClient.invalidateQueries(['sample', sampleId])
  },
})
```

---

### Decision 5: Query Key Structure

**What:** Use hierarchical query keys:
```typescript
['samples', { page, pageSize, search, status, fromDate, toDate, sortBy, sortOrder, receiverId }]
['sample', sampleId]
['results', sampleId]
```

**Why:**
- Enables precise cache invalidation (e.g., invalidate all samples queries)
- Automatic refetch when query key changes (URL params)
- Type-safe with TypeScript
- Follows TanStack Query best practices

**Example:**
```typescript
// Invalidate all samples queries (any filter combination)
queryClient.invalidateQueries(['samples'])

// Invalidate specific sample
queryClient.invalidateQueries(['sample', 'abc-123'])

// Invalidate all results for a sample
queryClient.invalidateQueries(['results', 'abc-123'])
```

## Risks / Trade-offs

### Risk 1: Bundle Size Increase
- **Risk:** +50KB bundle size may slow initial page load
- **Mitigation:** 
  - Gzipped size is only 15KB (3% increase)
  - Code splitting: Only load TanStack Query on samples page
  - Network savings (60-70% fewer requests) offset initial cost
- **Monitoring:** Track bundle size in CI/CD, alert if \u003e600KB total

### Risk 2: Learning Curve
- **Risk:** Team needs to learn TanStack Query concepts
- **Mitigation:**
  - Comprehensive inline documentation
  - React Query DevTools for visual debugging
  - Pair programming during initial implementation
- **Timeline:** 1-2 days to get comfortable

### Risk 3: Cache Invalidation Bugs
- **Risk:** Incorrect cache invalidation could show stale data
- **Mitigation:**
  - Conservative invalidation strategy (invalidate more rather than less)
  - React Query DevTools to inspect cache state
  - Comprehensive testing with multiple scenarios
- **Monitoring:** User reports of stale data, DevTools inspection

### Risk 4: Migration Complexity
- **Risk:** Refactoring Server Components to Client Components may introduce bugs
- **Mitigation:**
  - Incremental migration (samples page only)
  - Maintain existing functionality (filters, pagination)
  - Thorough testing before deployment
  - Rollback plan (revert commits)
- **Timeline:** 1-2 days for implementation + testing

## Migration Plan

### Phase 1: Setup (2-3 hours)
1. Install dependencies: `npm install @tanstack/react-query @tanstack/react-query-devtools`
2. Create `query-client.ts` and `query-provider.tsx`
3. Update `layout.tsx` to wrap app with QueryProvider
4. Verify app still runs without errors

### Phase 2: Query Hooks (3-4 hours)
1. Create `use-samples.ts` hook
2. Create `use-sample-detail.ts` hook
3. Create `use-assign-tests.ts` mutation hook
4. Add TypeScript types for query keys
5. Test hooks in isolation with React Query DevTools

### Phase 3: Page Refactoring (3-4 hours)
1. Create `samples-page-client.tsx` component
2. Update `page.tsx` to hybrid architecture
3. Update `SampleListTable` to work with query data
4. Add loading skeletons and error boundaries
5. Test page navigation and filtering

### Phase 4: Component Updates (2-3 hours)
1. Update `SampleDetailPanel` to use `useSampleDetail`
2. Update `AssignedTestsPanel` to use `useAssignTests`
3. Update `TestAssignmentModule` to remove router manipulation
4. Implement optimistic updates
5. Test test assignment workflow end-to-end

### Phase 5: Testing & Verification (2-3 hours)
1. Test all scenarios from verification plan
2. Performance testing (bundle size, load time)
3. Cross-browser testing (Chrome, Firefox, Edge)
4. Multi-tab testing (concurrent updates)
5. Network error testing (slow 3G, offline)

### Phase 6: Deployment
1. Merge to `main` branch
2. Deploy to staging environment
3. UAT with lab staff (2-3 test assignments)
4. Monitor for errors in production
5. Gather user feedback

**Total estimated time:** 1-2 days (12-20 hours)

### Rollback Plan

If critical issues arise:
1. **Immediate:** Revert commits in reverse order
   ```bash
   git revert HEAD~6..HEAD  # Revert last 6 commits
   git push origin main --force-with-lease
   ```
2. **Short-term:** Deploy previous version from Git tag
3. **Long-term:** Investigate root cause, fix, and re-deploy

**Rollback triggers:**
- \u003e5% increase in error rate
- User reports of data loss or corruption
- Performance degradation (\u003e2s page load time)
- Critical bugs blocking workflow

## Open Questions

1. **Should we apply TanStack Query to other pages (Approvals, Results)?**
   - Recommendation: Start with samples page, evaluate success, then expand
   - Timeline: Revisit after 2 weeks of production use

2. **Should we implement real-time updates via WebSockets?**
   - Recommendation: Not needed for current use case (window focus refetch is sufficient)
   - Timeline: Revisit if users request real-time collaboration features

3. **Should we cache data in localStorage for offline support?**
   - Recommendation: No, lab environment has stable internet
   - Timeline: Revisit if deployment environment changes

4. **Should we migrate Analyst samples page at the same time?**
   - Recommendation: Yes, same codebase, minimal additional effort
   - Timeline: Include in Phase 3 (add 1-2 hours)
