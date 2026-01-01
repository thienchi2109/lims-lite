# QC Analytics Date Range - Hybrid Approach

## Overview

Industrial-grade date range handling for Levey-Jennings chart and Sigma dashboard in the Manager Quality Control page.

**Created:** 2026-01-01
**Status:** Planning
**Phase:** Post Phase 15.7-15.8

## Problem Statement

Current implementation fetches 90 days of QC data server-side, with client-side filtering for 7/14/30/90 day views. Managers may need to:
- View historical data beyond 90 days
- Analyze long-term trends (180 days, 1 year, all time)
- Share specific date range views via URL

## Research Summary (Context7)

| Pattern | Source | Use Case |
|---------|--------|----------|
| URL searchParams | Next.js Server Components | Server-side filtering, shareable URLs |
| useInfiniteQuery | TanStack Query v5 | Cursor-based pagination, load more |
| Suspense + Streaming | Next.js 16 | Progressive loading |

## Solution: Hybrid URL Params + Cursor-Based Pagination

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  URL Params (Server-Side)         Client-Side (TanStack Query)  │
│  ┌─────────────────────┐          ┌─────────────────────────┐  │
│  │ ?qc_days=90 (def)   │          │ useInfiniteQuery        │  │
│  │ ?qc_days=180        │          │ - Load older data       │  │
│  │ ?qc_days=365        │          │ - Cursor: oldest date   │  │
│  │ ?qc_days=all        │          │ - maxPages: 5           │  │
│  └─────────────────────┘          └─────────────────────────┘  │
│           ↓                                  ↓                  │
│  Initial page load              "Tải thêm" button fetches      │
│  (fast, cacheable)              older data incrementally        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why Industrial-Grade

1. **URL Params for Initial Load**
   - Shareable URLs: `/manager/quality-control?qc_days=365`
   - Server-side rendering (fast initial load)
   - Browser history works correctly
   - Bookmarkable states

2. **Cursor-Based Pagination**
   - Avoids offset-based issues with large datasets
   - Memory-efficient (`maxPages` limits client memory)
   - Progressive loading (no full page reload)
   - Works with real-time data (new QC results don't break pagination)

3. **Scalability**
   - Database uses indexed `measured_at` column
   - Can handle millions of QC results
   - Predictable O(1) performance

## Implementation Tasks

### Task 1: URL Param Support in page.tsx
**Priority:** P2
**Estimate:** Small

Update server component to accept `searchParams.qc_days`:

```typescript
// page.tsx
export default async function QualityControlPage({
    searchParams,
}: {
    searchParams: Promise<{ qc_days?: string }>
}) {
    const { qc_days = '90' } = await searchParams
    const days = qc_days === 'all' ? null : parseInt(qc_days)

    // Fetch based on days param
    const cutoffDate = days
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : null
    // ...
}
```

### Task 2: Date Range Selector Component
**Priority:** P2
**Estimate:** Small

Create `qc-date-range-selector.tsx`:

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const DATE_RANGES = [
    { value: '90', label: '90 ngày' },
    { value: '180', label: '180 ngày' },
    { value: '365', label: '1 năm' },
    { value: 'all', label: 'Tất cả' },
]

export function QCDateRangeSelector() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const current = searchParams.get('qc_days') || '90'

    function handleChange(value: string) {
        const params = new URLSearchParams(searchParams)
        params.set('qc_days', value)
        router.push(`?${params.toString()}`)
    }

    return (
        <Select value={current} onValueChange={handleChange}>
            {/* ... */}
        </Select>
    )
}
```

### Task 3: Server Action for Cursor-Based Fetch
**Priority:** P2
**Estimate:** Small

Create `fetchOlderQCResults` action:

```typescript
// src/app/actions/qc-analytics.ts
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
    definitionId: z.string().uuid(),
    cursor: z.string().datetime(), // oldest date from current data
    limit: z.number().min(1).max(100).default(50),
})

export async function fetchOlderQCResults(input: z.infer<typeof schema>) {
    const supabase = await createClient()

    const { data } = await supabase
        .from('qc_results')
        .select('id, definition_id, value, z_score, status, measured_at, rule_violated')
        .eq('definition_id', input.definitionId)
        .lt('measured_at', input.cursor)
        .order('measured_at', { ascending: false })
        .limit(input.limit)

    const hasMore = data?.length === input.limit
    const nextCursor = data?.[data.length - 1]?.measured_at ?? null

    return { data: data ?? [], hasMore, nextCursor }
}
```

### Task 4: useInfiniteQuery Integration
**Priority:** P2
**Estimate:** Medium

Update `qc-analytics-tab.tsx` to use TanStack Query:

```typescript
'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchOlderQCResults } from '@/app/actions/qc-analytics'

export function QCAnalyticsTab({ definitions, initialResults }: Props) {
    const [selectedDefId, setSelectedDefId] = useState(definitions[0]?.id)

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['qc-results', selectedDefId],
        queryFn: async ({ pageParam }) => {
            return fetchOlderQCResults({
                definitionId: selectedDefId,
                cursor: pageParam,
                limit: 50,
            })
        },
        initialPageParam: initialResults[selectedDefId]?.[0]?.measured_at,
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        initialData: {
            pages: [{ data: initialResults[selectedDefId] ?? [], hasMore: true, nextCursor: null }],
            pageParams: [null],
        },
        maxPages: 5, // Memory limit
    })

    // Flatten pages for chart
    const allResults = data?.pages.flatMap(p => p.data) ?? []

    return (
        <>
            <LeveyJenningsChart dataPoints={allResults} />
            {hasNextPage && (
                <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                >
                    {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm dữ liệu cũ hơn'}
                </Button>
            )}
        </>
    )
}
```

### Task 5: Database Index Verification
**Priority:** P3
**Estimate:** Tiny

Verify index exists for cursor query:

```sql
-- Check existing index
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'qc_results';

-- Create if missing
CREATE INDEX IF NOT EXISTS idx_qc_results_definition_measured_at
ON qc_results(definition_id, measured_at DESC);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(dashboard)/manager/quality-control/page.tsx` | Add searchParams handling |
| `src/components/qc/qc-analytics-tab.tsx` | Add useInfiniteQuery, load more button |
| `src/components/qc/qc-date-range-selector.tsx` | NEW: Date range selector |
| `src/app/actions/qc-analytics.ts` | NEW: Server action for cursor fetch |
| `supabase/migrations/XXX_qc_results_index.sql` | NEW: Verify/add index |

## Testing Checklist

- [ ] URL param `?qc_days=90` loads 90 days (default)
- [ ] URL param `?qc_days=365` loads 1 year
- [ ] URL param `?qc_days=all` loads all data
- [ ] "Tải thêm" button fetches older data
- [ ] Chart updates with combined data
- [ ] maxPages limit prevents memory issues
- [ ] Browser back/forward preserves state
- [ ] Shareable URLs work correctly

## Performance Considerations

1. **Initial Load:** Server-side fetch with `searchParams` (cacheable)
2. **Load More:** Client-side with cursor (no offset skip)
3. **Memory:** `maxPages: 5` limits client memory (~250 data points max)
4. **Database:** Indexed cursor query is O(log n)

## Vietnamese Labels

| English | Vietnamese |
|---------|------------|
| Load more | Tải thêm |
| Loading... | Đang tải... |
| Load older data | Tải thêm dữ liệu cũ hơn |
| 90 days | 90 ngày |
| 180 days | 180 ngày |
| 1 year | 1 năm |
| All time | Tất cả |
