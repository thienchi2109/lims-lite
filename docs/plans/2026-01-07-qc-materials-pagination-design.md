# QC Materials Server-Side Pagination & Filters - Design

**Date:** 2026-01-07
**Status:** Approved
**Scope:** Quick-plan (UI enhancement, no breaking changes)

## Problem

The QC Materials table currently fetches ALL materials without pagination or filtering. As data grows, this becomes:
- Slow to load
- Hard to find specific materials
- Poor user experience

## Solution

Add server-side pagination and comprehensive filtering:

| Feature | Implementation |
|---------|----------------|
| **Pagination** | Server-side, page numbers, user-selectable size (10/20/50) |
| **Text search** | Name, Lot Number, Manufacturer (OR combined, debounced) |
| **Level filter** | Dropdown: Tất cả / Thấp / Bình thường / Cao |
| **Status filter** | Dropdown: Tất cả / Còn hạn / Sắp hết hạn / Hết hạn |
| **URL state** | Full persistence via search params |

## Architecture

```
URL Params → Server Component → Server Action → PostgreSQL
                                      ↓
                               QCMaterialsList
                    ┌──────────────┼──────────────┐
             FilterBar        Table        Pagination
           (updates URL)   (displays)    (updates URL)
```

## Query Optimization

| Strategy | Implementation |
|----------|----------------|
| Single query with count | `.select('*', { count: 'exact' })` |
| Database indexes | name, lot_number, manufacturer, level, expiration_date |
| No N+1 queries | Flat table, no joins needed |
| Race condition prevention | Server Components handle request cancellation |

## Component Structure

```
src/components/qc/
├── qc-materials-table.tsx          # ~170 lines (unchanged)
├── qc-materials-filter-bar.tsx     # ~80 lines (NEW)
├── qc-materials-pagination.tsx     # ~100 lines (NEW)
└── qc-materials-list.tsx           # ~60 lines (NEW orchestrator)
```

## Files to Modify

| File | Action |
|------|--------|
| `supabase/migrations/XXX_qc_materials_indexes.sql` | CREATE |
| `src/app/actions/qc-setup.ts` | MODIFY |
| `src/app/(dashboard)/manager/quality-control/page.tsx` | MODIFY |
| `src/components/qc/qc-materials-filter-bar.tsx` | CREATE |
| `src/components/qc/qc-materials-pagination.tsx` | CREATE |
| `src/components/qc/qc-materials-list.tsx` | CREATE |
| `src/components/qc/quality-control-page-client.tsx` | MODIFY |

## Constraints

- Each component file < 400 lines
- URL params prefixed with `mat_` to avoid conflicts with other tabs
- Vietnamese UI labels throughout
- No TanStack Query needed (Server Components handle caching)

## Implementation Plan

See: `C:\Users\win\.claude\plans\glowing-orbiting-spindle.md`
