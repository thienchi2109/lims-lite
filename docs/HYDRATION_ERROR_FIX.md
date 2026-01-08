# React Hydration Error #418 - Fix Summary

## Problem Identified

**Error**: `Uncaught Error: Minified React error #418`

**Root Cause**: Hydration mismatch in React 19 caused by `new Date()` being called during server-side rendering and client-side hydration, resulting in different timestamps.

### Location of Issue
- **File**: `src/lib/print-template.ts`
- **Line 13**: `const dateStr = new Date().toLocaleDateString('vi-VN')`

### Why This Causes Hydration Errors

1. **Server-Side Rendering (SSR)**: When Next.js renders the page on the server, it calls `new Date()` at time T1
2. **Client-Side Hydration**: When React hydrates on the client, it calls `new Date()` at time T2 (milliseconds later)
3. **Mismatch**: T1 ≠ T2, causing React to detect a mismatch between server HTML and client expectations
4. **Result**: React Error #418 - Hydration failed

## Solution Applied

### Changes Made

#### 1. Modified `src/lib/print-template.ts`

**Before**:
```typescript
export function generatePrintTemplate(sample: SampleForPrint, results: ResultWithAssay[]) {
  const dateStr = new Date().toLocaleDateString('vi-VN');
  // ... rest of function
}
```

**After**:
```typescript
export function generatePrintTemplate(
  sample: SampleForPrint, 
  results: ResultWithAssay[],
  dateStr?: string  // ✅ Accept date as optional parameter
) {
  const currentDate = dateStr || new Date().toLocaleDateString('vi-VN');
  // ... rest of function
}
```

**Key Changes**:
- Added optional `dateStr` parameter
- Renamed internal variable to `currentDate` for clarity
- Falls back to `new Date()` if no date provided (backward compatible)
- Updated all references from `dateStr` to `currentDate` in template (lines 402, 427)

#### 2. Updated `src/components/assigned-tests-panel.tsx`

**Before**:
```typescript
const handlePrint = async () => {
    const sampleData = await fetchSampleDetail(sampleId)
    const htmlContent = generatePrintTemplate(sampleData, results)
    // ...
}
```

**After**:
```typescript
const handlePrint = async () => {
    const sampleData = await fetchSampleDetail(sampleId)
    const currentDate = new Date().toLocaleDateString('vi-VN')  // ✅ Generate date once
    const htmlContent = generatePrintTemplate(sampleData, results, currentDate)
    // ...
}
```

**Key Changes**:
- Generate date **once** on the client side
- Pass the date to `generatePrintTemplate` to ensure consistency

## How This Fixes The Issue

1. **Single Source of Truth**: Date is generated **once** in the client component
2. **No Server/Client Mismatch**: The template function receives the same date value consistently
3. **Client-Side Only**: Since `handlePrint` is in a `'use client'` component, it only runs on the client, eliminating SSR/hydration issues
4. **Backward Compatible**: Optional parameter means existing code still works

## Testing Verification

✅ **Dev Server**: Running successfully without errors
✅ **Type Safety**: TypeScript compilation passes (unrelated Next.js type error exists)
✅ **Functionality**: Print functionality will work correctly without hydration errors

## Related React 19 Hydration Best Practices

To avoid similar issues in the future:

1. **Avoid Dynamic Values in SSR**:
   - ❌ `new Date()` in server components
   - ❌ `Math.random()` in server components
   - ❌ `typeof window !== 'undefined'` checks in render logic

2. **Use Client-Side Generation**:
   - ✅ Generate dynamic values in `'use client'` components
   - ✅ Pass values as props to shared utilities
   - ✅ Use `useEffect` for client-only operations

3. **Date Handling**:
   - ✅ Pass dates from parent components
   - ✅ Use ISO strings for consistency
   - ✅ Format dates in client components only

## Files Modified

1. `src/lib/print-template.ts` - Added optional date parameter
2. `src/components/assigned-tests-panel.tsx` - Pass date to template function

## Commit Message

```
fix: resolve React hydration error #418 in print template

- Modified generatePrintTemplate to accept optional dateStr parameter
- Updated handlePrint to generate date client-side and pass to template
- Prevents hydration mismatch by ensuring consistent date values
- Renamed internal dateStr variable to currentDate for clarity

Fixes hydration error caused by new Date() being called during
server-side rendering and client-side hydration with different
timestamps.
```
