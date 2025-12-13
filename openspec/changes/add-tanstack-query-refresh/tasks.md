## 1. Setup & Dependencies ✅
- [x] 1.1 Install `@tanstack/react-query` and `@tanstack/react-query-devtools` packages
- [x] 1.2 Create `src/lib/query-client.ts` with QueryClient configuration
- [x] 1.3 Create `src/components/query-provider.tsx` wrapper component
- [x] 1.4 Update `src/app/layout.tsx` to wrap app with QueryProvider

## 2. Query Hooks ✅
- [x] 2.1 Create `src/hooks/use-samples.ts` for fetching samples with filters
- [x] 2.2 Create `src/hooks/use-sample-detail.ts` for fetching single sample
- [x] 2.3 Create `src/hooks/use-assign-tests.ts` mutation hook with cache invalidation
- [x] 2.4 Add TypeScript types for query keys in `src/types/query-keys.ts`
- [x] 2.5 Create `src/hooks/use-sample-tests.ts` for fetching assigned tests (bonus)
- [x] 2.6 Create `src/hooks/index.ts` barrel export (bonus)

## 3. Page Refactoring ✅
- [x] 3.1 Create `src/components/samples-page-client.tsx` client component
- [x] 3.2 Update `src/app/(dashboard)/manager/samples/page.tsx` to hybrid architecture
- [x] 3.3 Update `src/components/sample-list-table.tsx` to work with query data
- [x] 3.4 Add loading skeletons and error boundaries

## 4. Component Updates ✅
- [x] 4.1 Update `src/components/sample-detail-panel.tsx` to use query cache invalidation
- [x] 4.2 Update `src/components/assigned-tests-panel.tsx` to use query cache invalidation
- [x] 4.3 Update `src/components/test-assignment-module.tsx` to invalidate queries after assignment
- [x] 4.4 Replace all `router.refresh()` calls with `queryClient.invalidateQueries()`

## 5. Server Actions ✅
- [x] 5.1 Add `revalidatePath('/manager/samples')` to `assignTests` action (already present)
- [x] 5.2 Add `revalidatePath('/analyst/samples')` to `assignTests` action (already present)
- [x] 5.3 Verify `revalidatePath` in `createSample`, `updateSample`, `submitSampleForReview` (all present)
- [x] 5.4 Add samples page revalidation to `saveBatchResults` for status updates
- [x] 5.5 Verify proper error handling and response data (all correct)

## 6. Testing & Verification ✅ (Automated) / ⏳ (Manual)
- [x] 6.1 Run `npm run typecheck` - No TypeScript errors ✅
- [x] 6.2 Run `npm run build` - Production build successful ✅
- [x] 6.3 Verify bundle size impact (~26KB, within target) ✅
- [x] 6.4 Verify React Query DevTools available in development ✅
- [x] 6.5 Code review: All router.refresh() replaced with cache invalidation ✅
- [x] 6.6 Code review: All server actions have revalidatePath ✅
- [ ] 6.7 Manual: Test assignment auto-refresh (grid navigates to page 1) ⏳
- [ ] 6.8 Manual: Verify status badge updates instantly without refresh ⏳
- [ ] 6.9 Manual: Test with active filters (status, search, date range) ⏳
- [ ] 6.10 Manual: Test concurrent updates in multiple tabs ⏳
- [ ] 6.11 Manual: Test network error handling ⏳

**See VERIFICATION.md for detailed testing checklist and results.**
