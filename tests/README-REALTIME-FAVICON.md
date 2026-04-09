# Realtime Favicon Badge Tests

## Overview

This test suite verifies the functionality of the realtime favicon badge update feature, which shows a notification badge on the browser's favicon when there are pending approvals in the LIMS system.

## Test Files

### `realtime-favicon-badge.test.ts`

Comprehensive unit tests for the `useFaviconBadge` hook and its helper functions.

**Test Coverage:**

1. **Canvas Drawing**
   - ✅ Canvas element creation
   - ⏭️ Canvas data URL export (skipped - requires native canvas)
   - ⏭️ 2D rendering context (skipped - requires native canvas)

2. **Helper Functions**
   - `clampToNonNegativeInteger()` - Validates number clamping logic
   - `formatBadgeLabel()` - Validates badge label formatting (e.g., "99+")
   - `parseLinkIconSize()` - Validates favicon size parsing
   - `getFaviconLinks()` - Validates favicon link detection

3. **Image Loading**
   - Image element creation
   - CORS configuration
   - Load success/failure callbacks

4. **Realtime Integration**
   - Migration verification for Supabase Realtime
   - Confirms `supabase_realtime` publication for `public.samples` table

5. **Badge Drawing Parameters**
   - Radius calculation based on icon size
   - Position calculation (top-right corner)
   - Font size calculation based on label length
   - Stroke width calculation

6. **Default Options**
   - Badge color (#ef4444 - Tailwind red-500)
   - Text color (#ffffff - white)
   - Max count (99)

## Running Tests

```bash
# Run all tests
npm test

# Run only favicon badge tests
npx vitest run tests/realtime-favicon-badge.test.ts

# Run tests with UI
npm run test:ui

# Run tests in watch mode (interactive)
npm test -- --watch
```

## Test Results

As of 2025-12-16:
- **32 tests total**
- **30 passing** ✅
- **2 skipped** ⏭️ (Canvas API tests - require native implementation)

## Implementation Details

### Realtime Flow

1. **User Action**: A sample status changes (e.g., approved, pending review)
2. **Database Event**: PostgreSQL triggers Supabase Realtime event
3. **Client Subscription**: `ApprovalTabsClient` receives event via WebSocket
4. **Debounced Update**: 250ms delay to prevent excessive API calls
5. **Count Fetch**: `getSamplesForApprovalCount()` server action is called
6. **Badge Update**: `useFaviconBadge` hook draws the new count on favicon
7. **Router Refresh**: Page data is refreshed (only on review tab)

### Badge Drawing Algorithm

The badge is drawn using HTML5 Canvas API:

1. **Load original favicon** via Image element with CORS
2. **Create canvas** with favicon dimensions (16x16, 32x32, etc.)
3. **Draw original icon** as background
4. **Draw badge circle** at top-right corner
5. **Draw count text** centered in circle
6. **Export as data URL** (PNG format)
7. **Update favicon href** with new image

### Debouncing Strategy

Multiple rapid database events are debounced to a single API call:
- **Delay**: 250ms after last event
- **Prevents**: API spam during bulk operations
- **Ensures**: Latest count is always fetched

## Known Limitations

### Canvas Tests Skipped

Two tests are skipped because jsdom (the test DOM implementation) doesn't fully support the Canvas API:
- `HTMLCanvasElement.toDataURL()`
- `HTMLCanvasElement.getContext('2d')`

These methods work correctly in real browsers. To test them, you would need to:
1. Install the `canvas` npm package
2. Configure jsdom to use the native canvas implementation
3. Or use browser-based testing (e.g., Playwright, Cypress)

The implementation is verified through:
- Manual browser testing
- Helper function unit tests
- Hook and integration-focused Vitest coverage

## Migration Verification

The test suite verifies that migration `063_enable_samples_realtime.sql` exists and contains:

```sql
-- Enable Realtime for samples table
ALTER PUBLICATION supabase_realtime ADD TABLE public.samples;
```

This migration is required for the Realtime subscription to work.

## Future Improvements

1. **E2E Tests**: Add Playwright tests to verify badge updates in real browser
2. **Performance Tests**: Measure impact of badge drawing on render performance
3. **Accessibility Tests**: Verify screen reader announcements for count changes
4. **Cross-browser Tests**: Test on different browsers (Chrome, Firefox, Safari)
5. **Load Tests**: Verify debouncing under high-frequency update scenarios

## Related Files

- `src/hooks/use-favicon-badge.ts` - Main hook implementation
- `src/components/approval-tabs-client.tsx` - Realtime integration
- `src/app/actions/samples.ts` - Server action for count
- `src/lib/api-client.ts` - Client-side API wrapper
- `supabase/migrations/063_enable_samples_realtime.sql` - Database migration

## References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Canvas API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Vitest Documentation](https://vitest.dev/)
- [jsdom Canvas Limitations](https://github.com/jsdom/jsdom#canvas-support)
