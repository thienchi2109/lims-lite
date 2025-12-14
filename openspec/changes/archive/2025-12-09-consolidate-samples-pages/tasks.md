## Phase 1: Current State Analysis ✅

- [x] 1.1 Audit manager samples page architecture (TanStack Query confirmed)
- [x] 1.2 Audit analyst samples page architecture (legacy server-rendering confirmed)
- [x] 1.3 Review existing TanStack Query implementation from `add-tanstack-query-refresh`
- [x] 1.4 Document differences between analyst and manager implementations
- [x] 1.5 Identify shared components that need updates

## Phase 2: Create Unified Server Component

- [x] 2.1 Create `src/app/samples/page.tsx` with force-dynamic export
- [x] 2.2 Implement authentication and role checking
- [x] 2.3 Build permissions object based on role
- [x] 2.4 Fetch receiver options server-side
- [x] 2.5 Determine homeHref based on role
- [x] 2.6 Render SamplesPageClient with all required props
- [x] 2.7 Add proper TypeScript types for permissions

## Phase 3: Update SamplesPageClient Component

- [x] 3.1 Add new props to SamplesPageClientProps interface (role, permissions, homeHref)
- [x] 3.2 Update back link to use homeHref instead of isManager conditional
- [x] 3.3 Pass permissions to SampleListTable
- [x] 3.4 Pass permissions to SampleBottomRow
- [x] 3.5 Keep existing TanStack Query hooks (useSamples, useSampleDetail)
- [x] 3.6 Test data fetching works for both roles

## Phase 4: Update Shared Components

- [x] 4.1 Update SampleListTable to accept permissions prop instead of isManager
- [x] 4.2 Update actions column logic to check granular permissions
- [x] 4.3 Update SampleBottomRow to accept and pass permissions
- [x] 4.4 Update SampleDetailPanel to gate edit/reject/ignore by permissions
- [x] 4.5 Ensure Vietnamese text remains unchanged
- [x] 4.6 Remove route-based permission checks (pathname.includes)

## Phase 5: Create Legacy Route Redirects

- [x] 5.1 Convert `/analyst/samples/page.tsx` to thin redirect wrapper
- [x] 5.2 Convert `/manager/samples/page.tsx` to thin redirect wrapper
- [x] 5.3 Implement query string preservation in redirects
- [x] 5.4 Test redirect with various query parameter combinations
- [x] 5.5 Ensure authentication still required before redirect

## Phase 6: Update Server Actions

- [x] 6.1 Add `/samples` to revalidatePath in createSample (line 74-76)
- [x] 6.2 Add `/samples` to revalidatePath in accessionAndAssignTests (line 116-118)
- [x] 6.3 Add `/samples` to revalidatePath in updateSample (line 165-166)
- [x] 6.4 Add `/samples` to revalidatePath in assignTests (line 270-271)
- [x] 6.5 Add `/samples` to revalidatePath in unassignTests (line 343-344)
- [x] 6.6 Add `/samples` to revalidatePath in submitSampleForReview (line 631-632)
- [x] 6.7 Keep existing paths for backward compatibility

## Phase 7: Testing - Analyst Role

- [x] 7.1 Login as analyst, navigate to /analyst/samples (should redirect)
- [x] 7.2 Verify redirect preserves query parameters
- [x] 7.3 Verify can view samples list with all filters
- [x] 7.4 Verify can edit sample when status=received
- [x] 7.5 Verify can enter results when status=assigned/in_progress
- [x] 7.6 Verify CANNOT see reject/ignore buttons
- [x] 7.7 Verify auto-refresh after test assignment navigates to page 1
- [x] 7.8 Verify status badge updates instantly
- [x] 7.9 Test pagination, sorting, search, filters
- [x] 7.10 Test sample detail panel loads correctly
- [x] 7.11 Verify back link points to /analyst dashboard

## Phase 8: Testing - Manager Role

- [x] 8.1 Login as manager, navigate to /manager/samples (should redirect)
- [x] 8.2 Verify redirect preserves query parameters
- [x] 8.3 Verify can view samples list with receiver filter
- [x] 8.4 Verify can reject/ignore when status=received/assigned
- [x] 8.5 Verify can view results for all statuses
- [x] 8.6 Verify CANNOT enter results (analyst only)
- [x] 8.7 Verify auto-refresh after actions
- [x] 8.8 Verify status badge updates instantly
- [x] 8.9 Test all filters including receiver filter
- [x] 8.10 Verify back link points to /manager dashboard

## Phase 9: Cross-Role Testing

- [x] 9.1 Test permissions are enforced (analyst cannot access manager actions)
- [x] 9.2 Test with active filters, ensure persistence after refresh
- [x] 9.3 Test multi-tab scenario (window focus refetch)
- [x] 9.4 Test network error handling and retry logic
- [x] 9.5 Verify React Query DevTools shows correct cache entries
- [x] 9.6 Test inline editing (client name) with cache invalidation
- [x] 9.7 Test direct navigation to /samples (should work without redirect)

## Phase 10: Documentation and Cleanup

- [x] 10.1 Update GEMINI.md to reference unified /samples route
- [x] 10.2 Update OpenSpec docs to reflect new architecture
- [x] 10.3 Add comments explaining permissions structure
- [x] 10.4 Run typecheck to ensure no TypeScript errors
- [x] 10.5 Run build to verify production bundle
- [x] 10.6 Document migration in NOTES.md or changelog
- [x] 10.7 Update any navigation links in dashboard components

## Notes

**Estimated Effort:** 2-3 days (16-24 hours)

**Critical Path:**
1. Phase 2: Unified server component (4-5 hours)
2. Phase 3-4: Component updates (4-5 hours)
3. Phase 5: Redirects (2-3 hours)
4. Phase 7-9: Testing (6-8 hours)

**Rollback Plan:**
- Keep legacy routes functional during initial rollout
- If critical issues arise, can quickly revert /samples to redirect back to legacy routes
- Git revert strategy: Create feature branch, merge only after full testing

**Success Metrics:**
- All manual tests pass (Phase 7-9)
- No TypeScript errors
- Production build succeeds
- Both roles report smooth workflow
- Auto-refresh works 100% reliably
