# Design: Consolidate Samples Workspace

## Current State Analysis

### Manager Samples Page (`/manager/samples`) ✅
- **Architecture:** Hybrid Server/Client with TanStack Query
- **Component:** `SamplesPageClient` (line 60-63)
- **Data Fetching:** Client-side via `useSamples`, `useSampleDetail` hooks
- **Receiver Options:** Fetched server-side, passed as prop (lines 32-45)
- **Lines of Code:** 68 (server component delegates to client)
- **Migrated:** Dec 7, 2025 (commit d4b5223)

### Analyst Samples Page (`/analyst/samples`) ❌
- **Architecture:** Pure Server Components
- **Data Fetching:** Server-side `getSamples()`, `getSample()` calls (lines 64, 69)
- **Props Passing:** Passes server data directly to client components
- **Lines of Code:** 131
- **Status:** **NOT migrated to TanStack Query**

### Key Differences
| Aspect | Analyst | Manager |
|--------|---------|---------|
| Data Fetching | Server actions | TanStack Query hooks |
| Auto-refresh | Unreliable router.refresh() | Reliable query invalidation |
| Caching | None | TanStack Query cache |
| Receiver Filter | No | Yes |

## Unified Architecture Design

### Approach
1. **Single `/samples` Server Component** (force-dynamic)
   - Authenticate user via Supabase server client
   - Determine role (analyst/manager)
   - Build `permissions` object:
     ```typescript
     {
       canReject: role === 'manager' && ['received', 'assigned'].includes(status),
       canIgnore: role === 'manager' && ['received', 'assigned'].includes(status),
       canEdit: true, // Both roles
       canViewResults: true, // Both roles
       canEnterResults: role === 'analyst', // Analyst only
     }
     ```
   - Fetch receiver options once (server-side)
   - Determine `homeHref`: `/analyst` or `/manager`
   - Render `SamplesPageClient` with props

2. **Extend `SamplesPageClient`** (client component)
   - Accept new props: `role`, `permissions`, `homeHref`
   - Use existing TanStack Query hooks: `useSamples`, `useSampleDetail`
   - Parse search params (already implemented)
   - Pass `permissions` down to child components
   - Render back link using `homeHref`

3. **Update Shared Components**
   - `SampleListTable`: Gate actions column rendering via `permissions`
   - `SampleBottomRow`: Pass `permissions` to children
   - `SampleDetailPanel`: Check permissions before showing edit/reject/ignore
   - Remove route-based conditionals (`pathname.includes('/manager')`)

4. **Legacy Route Redirects**
   - `/analyst/samples` → Authenticate, verify role, redirect to `/samples?role=analyst&{queryString}`
   - `/manager/samples` → Authenticate, verify role, redirect to `/samples?role=manager&{queryString}`
   - Preserve all query parameters (page, status, search, etc.)

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Server Component: /samples/page.tsx                         │
│ - Authenticate user                                          │
│ - Get role from database                                     │
│ - Build permissions object                                   │
│ - Fetch receiver options (server-side)                       │
│ - Determine homeHref                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Client Component: SamplesPageClient                         │
│ - Parse search params                                        │
│ - useSamples({ params }) → TanStack Query                   │
│ - useSampleDetail({ sampleId }) → TanStack Query            │
│ - Pass data + permissions to children                        │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐    ┌─────────────────────┐
│ SampleListTable │    │ SampleBottomRow     │
│ - isManager     │    │ - permissions       │
│ - permissions   │    │ - sample data       │
└─────────────────┘    └─────────────────────┘
```

## Component Updates

### 1. `/samples/page.tsx` (NEW)
```typescript
export default async function UnifiedSamplesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')
  
  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()
  
  const role = userData?.role
  if (!['analyst', 'manager'].includes(role)) {
    redirect('/login')
  }
  
  // Fetch receiver options (needed for filters)
  const { data: receiverData } = await supabase
    .from('users')
    .select('id, full_name')
    .order('full_name', { ascending: true })
  
  const receiverOptions = receiverData?.map(r => ({
    id: r.id,
    name: r.full_name || ''
  })) || []
  
  const permissions = {
    canReject: role === 'manager',
    canIgnore: role === 'manager',
    canEdit: true,
    canViewResults: true,
    canEnterResults: role === 'analyst',
  }
  
  const homeHref = role === 'manager' ? '/manager' : '/analyst'
  
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
      <DashboardHeader subtitle="Quản lý mẫu" user={userData} />
      <Suspense fallback={<LoadingSpinner />}>
        <SamplesPageClient
          role={role}
          permissions={permissions}
          homeHref={homeHref}
          receiverOptions={receiverOptions}
        />
      </Suspense>
    </div>
  )
}
```

### 2. `SamplesPageClient` Updates
```typescript
interface SamplesPageClientProps {
  role: 'analyst' | 'manager'
  permissions: {
    canReject: boolean
    canIgnore: boolean
    canEdit: boolean
    canViewResults: boolean
    canEnterResults: boolean
  }
  homeHref: string
  receiverOptions: Array<{ id: string; name: string }>
}

export function SamplesPageClient({
  role,
  permissions,
  homeHref,
  receiverOptions
}: SamplesPageClientProps) {
  // Existing implementation, just add:
  // - Link href={homeHref}
  // - Pass permissions to SampleListTable
  // - Pass permissions to SampleBottomRow
}
```

### 3. `SampleListTable` Updates
- Change `isManager` prop to `permissions` object
- Update actions column logic to check `permissions.canReject`, etc.
- More granular control than boolean flag

### 4. Legacy Route Wrappers
```typescript
// /analyst/samples/page.tsx
export default async function AnalystSamplesRedirect({
  searchParams
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')
  
  const params = await searchParams
  const query = new URLSearchParams(params as any).toString()
  redirect(`/samples${query ? `?${query}` : ''}`)
}

// /manager/samples/page.tsx - similar
```

## Migration Strategy

### Phase 1: Create Unified Page
- Create `/samples/page.tsx` with auth + role checks
- Build permissions object
- Render `SamplesPageClient`

### Phase 2: Update Client Components
- Extend `SamplesPageClient` props
- Update `SampleListTable` to use permissions
- Update `SampleBottomRow` to pass permissions

### Phase 3: Create Redirects
- Convert `/analyst/samples` to redirect wrapper
- Convert `/manager/samples` to redirect wrapper
- Test query string preservation

### Phase 4: Update Server Actions
- Add `/samples` to all revalidatePath calls
- Keep `/analyst/samples` and `/manager/samples` for backward compatibility

### Phase 5: Testing
- Test as analyst: filters, pagination, edit, enter results
- Test as manager: filters, pagination, view results, reject/ignore
- Test redirects with query strings
- Test permissions enforcement

## Risks and Mitigations

### Risk 1: Analyst Page Migration Complexity
- **Impact:** Analyst page changes from server-rendered to client-side TanStack Query
- **Mitigation:** 
  - Reuse existing `useSamples` and `useSampleDetail` hooks from manager page
  - Test thoroughly before removing legacy route

### Risk 2: Permissions Regression
- **Impact:** Analyst could see manager-only actions or vice versa
- **Mitigation:**
  - Centralized permissions object built server-side
  - Double-check permissions in both components and server actions (RLS)
  - Add automated tests for permission checks

### Risk 3: Query String Handling
- **Impact:** Bookmarks or deep links could break
- **Mitigation:**
  - Preserve all query params in redirects
  - Test with various query combinations
  - Keep legacy routes for 1-2 weeks as fallback

### Risk 4: Drift from TanStack Query Implementation
- **Impact:** Using outdated patterns or incorrectly invalidating cache
- **Mitigation:**
  - Follow patterns from `add-tanstack-query-refresh` change
  - Use same query keys (`sampleKeys`)
  - Review TanStack Query DevTools during testing

## Testing Checklist

### Analyst Role
- [ ] Can view samples list with filters
- [ ] Can edit sample (status=received)
- [ ] Can enter results (status=assigned/in_progress)
- [ ] Cannot see manager-only actions (reject/ignore)
- [ ] Auto-refresh works after test assignment
- [ ] Redirected from `/analyst/samples` preserves filters

### Manager Role
- [ ] Can view samples list with filters
- [ ] Can reject/ignore (status=received/assigned)
- [ ] Can view results (all statuses)
- [ ] Cannot enter results
- [ ] Auto-refresh works after actions
- [ ] Redirected from `/manager/samples` preserves filters

### Both Roles
- [ ] Pagination works correctly
- [ ] Sorting works correctly
- [ ] Search filter works
- [ ] Status filter works
- [ ] Date range filter works
- [ ] Receiver filter works (manager only shows this)
- [ ] Sample detail panel loads correctly
- [ ] Back link goes to correct dashboard
- [ ] Query invalidation triggers refetch
- [ ] Window focus refetch works

## Success Criteria

1. ✅ Single codebase for samples page
2. ✅ Both roles have TanStack Query benefits
3. ✅ Permissions correctly enforced
4. ✅ No feature parity gaps
5. ✅ Auto-refresh works 100% for both roles
6. ✅ Legacy routes redirect correctly
7. ✅ All existing functionality preserved

### Caveats to watch:

  - Permission regressions: gate actions via a clear permissions object and keep RLS as the ultimate backstop.
  - Bundle/UX: analysts pick up the TanStack Query weight; ensure loading states stay smooth.
  - Redirect fidelity: preserve query params on /analyst/samples and /manager/samples redirects.