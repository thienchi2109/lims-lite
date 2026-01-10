# QC Definitions Table Pagination Design

**Date:** 2026-01-10
**Status:** Approved via brainstorming

## Problem

The "Giới hạn" (Control Limits) tab in the QC management page displays all QC definitions without pagination. Other tabs (Materials, Sessions) have proper server-side pagination. This inconsistency needs to be fixed to:
- Match the UX pattern of other tabs
- Scale properly as definitions grow
- Provide consistent navigation experience

## Solution

Implement server-side pagination for QCDefinitionsTable, matching the pattern established by QCSessionsTable.

## Architecture

```
URL Params: def_page, def_size
     │
     ▼
page.tsx (Server Component)
  - Parses URL search params
  - Calls getQCDefinitionsPaginated(filters)
  - Passes result to QualityControlPageClient
     │
     ▼
QualityControlPageClient
  - Receives definitions + pagination metadata
  - Passes to QCDefinitionsTable
     │
     ▼
QCDefinitionsTable
  - Renders table rows
  - Renders DataTablePagination with def_ prefix
```

## Changes Required

### 1. Server Action (qc-setup.ts)

New function `getQCDefinitionsPaginated`:

```typescript
interface QCDefinitionsFilters {
  page?: number
  page_size?: number
  search?: string
  status?: 'active' | 'inactive' | null
}

interface QCDefinitionsResult {
  data: QCDefinitionWithDetails[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
```

### 2. QCDefinitionsTable Component

Update props interface:
```typescript
interface QCDefinitionsTableProps {
  definitions: QCDefinitionWithDetails[]
  total: number
  page: number
  pageSize: number
}
```

Add `DataTablePagination` with `paramPrefix="def_"`.

### 3. QualityControlPageClient

Add new props:
- `definitionsTotal: number`
- `definitionsPage: number`
- `definitionsPageSize: number`

### 4. Page.tsx

Parse URL params:
- `def_page` (default: 1)
- `def_size` (default: 20)

Call `getQCDefinitionsPaginated` instead of fetching all.

## Out of Scope

- Filter bar (search, status dropdown) - can be added later
- Client-side refetch/loading states
- Sorting

## Files Affected

| File | Changes |
|------|---------|
| `src/app/actions/qc-setup.ts` | Add `getQCDefinitionsPaginated` |
| `src/types/qc.ts` | Add filter/result types |
| `src/components/qc/qc-definitions-table.tsx` | Add pagination props and component |
| `src/components/qc/quality-control-page-client.tsx` | Update props interface |
| `src/app/(dashboard)/manager/qc/page.tsx` | Parse params, call paginated action |
