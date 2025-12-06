## 1. Setup & Dependencies
- [ ] 1.1 Install `@tanstack/react-query` and `@tanstack/react-query-devtools` packages
- [ ] 1.2 Create `src/lib/query-client.ts` with QueryClient configuration
- [ ] 1.3 Create `src/components/query-provider.tsx` wrapper component
- [ ] 1.4 Update `src/app/layout.tsx` to wrap app with QueryProvider

## 2. Query Hooks
- [ ] 2.1 Create `src/hooks/use-samples.ts` for fetching samples with filters
- [ ] 2.2 Create `src/hooks/use-sample-detail.ts` for fetching single sample
- [ ] 2.3 Create `src/hooks/use-assign-tests.ts` mutation hook with cache invalidation
- [ ] 2.4 Add TypeScript types for query keys in `src/types/query-keys.ts`

## 3. Page Refactoring
- [ ] 3.1 Create `src/components/samples-page-client.tsx` client component
- [ ] 3.2 Update `src/app/(dashboard)/manager/samples/page.tsx` to hybrid architecture
- [ ] 3.3 Update `src/components/sample-list-table.tsx` to work with query data
- [ ] 3.4 Add loading skeletons and error boundaries

## 4. Component Updates
- [ ] 4.1 Update `src/components/sample-detail-panel.tsx` to use `useSampleDetail` hook
- [ ] 4.2 Update `src/components/assigned-tests-panel.tsx` to use `useAssignTests` mutation
- [ ] 4.3 Update `src/components/test-assignment-module.tsx` to remove router manipulation
- [ ] 4.4 Implement optimistic updates for instant UI feedback

## 5. Server Actions
- [ ] 5.1 Add `revalidatePath('/manager/samples')` to `assignTests` action
- [ ] 5.2 Add `revalidatePath('/analyst/samples')` to `assignTests` action
- [ ] 5.3 Ensure proper error handling and response data

## 6. Testing & Verification
- [ ] 6.1 Test test assignment with auto-refresh (grid navigates to page 1)
- [ ] 6.2 Verify status badge updates instantly without manual refresh
- [ ] 6.3 Test with active filters (status, search, date range)
- [ ] 6.4 Test concurrent updates in multiple tabs
- [ ] 6.5 Test network error handling and optimistic rollback
- [ ] 6.6 Verify React Query DevTools shows correct cache state
- [ ] 6.7 Run `npm run typecheck` to ensure no TypeScript errors
- [ ] 6.8 Performance testing: measure bundle size and load time impact
