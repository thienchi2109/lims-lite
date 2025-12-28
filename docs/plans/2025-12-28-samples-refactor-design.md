# Samples.ts Refactoring Design

**Date:** 2025-12-28
**Status:** Approved
**Goal:** Reduce `src/app/actions/samples.ts` from ~865 lines to <350 lines per file

## Problem Statement

The current `samples.ts` file has grown to 865 lines with:
- 16 exported functions covering multiple domains
- Repeated auth/role checks (~12 lines × 10+ occurrences)
- Duplicated query logic between `getSamplesForApproval` and `getSamplesWithTab`
- Type safety leak (`any` type in `updateSample`)

## Solution Overview

Split by domain into focused files with shared auth utilities.

## New File Structure

```
src/
├── lib/
│   └── auth-helpers.ts          # NEW: Auth utilities (~40 lines)
└── app/actions/
    ├── samples.ts               # REFACTORED: Core CRUD (~120 lines)
    ├── sample-tests.ts          # NEW: Test assignment (~100 lines)
    └── sample-approvals.ts      # NEW: Workflow/approval (~130 lines)
```

### File Responsibilities

| File | Functions | Purpose |
|------|-----------|---------|
| `auth-helpers.ts` | `requireAuth()`, `requireRole()`, `isAuthError()` | Reusable auth guards |
| `samples.ts` | `createSample`, `updateSample`, `getSamples`, `getSample`, `accessionAndAssignTests` | Core sample operations |
| `sample-tests.ts` | `assignTests`, `unassignTests`, `getAssayDefinitions`, `getSampleTests` | Test assignment logic |
| `sample-approvals.ts` | `getSamplesWithTab`, `getSamplesForApprovalCount`, `submitSampleForReview`, `rejectSample`, `discardSample` | Manager approval workflow |

## Design Details

### 1. Auth Helpers (`src/lib/auth-helpers.ts`)

```typescript
type UserRole = 'analyst' | 'manager'

interface AuthenticatedUser {
  id: string
  role: UserRole
}

interface AuthError {
  error: string
}

// Validates session, returns user with role
export async function requireAuth(): Promise<AuthenticatedUser | AuthError>

// Validates session + role check
export async function requireRole(role: UserRole | UserRole[]): Promise<AuthenticatedUser | AuthError>

// Type guard for error handling
export function isAuthError(result: unknown): result is AuthError
```

**Usage pattern:**

```typescript
// Before (12 lines repeated)
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: 'Unauthorized' }
const { data: userData } = await supabase.from('users').select('role')...
if (userData?.role !== 'manager') return { error: '...' }

// After (2 lines)
const auth = await requireRole('manager')
if (isAuthError(auth)) return auth
```

### 2. Consolidated Approval Query

**Removed:** `getSamplesForApproval()`
**Replacement:** `getSamplesWithTab('review')`

```typescript
type ApprovalTab = 'review' | 'completed'

export async function getSamplesWithTab(tab: ApprovalTab) {
    const auth = await requireRole('manager')
    if (isAuthError(auth)) return auth

    const { data: samples } = await supabase
        .from('samples')
        .select(`...`)
        .eq('status', tab)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

    return { data: transformSamplesWithCounts(samples) }
}
```

### 3. `updateSample` Typing Fix

**Before:**
```typescript
const updateData: any = {}
```

**After:**
```typescript
type SampleUpdateFields = Omit<UpdateSample, 'id'>

const { id, ...fields } = validatedData
const updateData = Object.fromEntries(
    Object.entries(fields).filter(([_, v]) => v !== undefined)
) as Partial<SampleUpdateFields>
```

## Breaking Changes

| Removed | Replacement | Migration |
|---------|-------------|-----------|
| `getSamplesForApproval()` | `getSamplesWithTab('review')` | Update all callers |

## Implementation Order

1. Create `src/lib/auth-helpers.ts`
2. Create `src/app/actions/sample-tests.ts` (extract test functions)
3. Create `src/app/actions/sample-approvals.ts` (extract + consolidate approval functions)
4. Refactor `src/app/actions/samples.ts` (update imports, fix typing, use auth helpers)
5. Update callers of `getSamplesForApproval()` → `getSamplesWithTab('review')`
6. Run typecheck + test

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| `samples.ts` lines | 865 | ~120 |
| Total lines (4 files) | 865 | ~390 |
| Auth boilerplate | 12 lines × 10+ | 2 lines each |
| Duplicate queries | 2 functions | 1 function |
| Type safety | `any` usage | Full typing |
