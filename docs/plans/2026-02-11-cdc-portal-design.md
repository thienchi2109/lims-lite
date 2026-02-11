# Plan: Refactor Root Page into CDC Portal

## Context

The current root route (`/`) is unreachable — middleware always redirects it to `/login` or the user's dashboard. The user wants to transform the root into a **public portal page** where users can choose which CDC web application to access via clickable cards. This serves as a hub for 4 apps: CDC LIMS (internal) and 3 external systems.

## Design Summary

- **Portal at `/`**: Public landing page with a 2x2 card grid showing 4 apps
- **CDC LIMS card** → navigates to `/login` (same tab)
- **3 external cards** → open in new tabs (`target="_blank"`)
- **Visual style**: Glass-morphism cards matching the existing analyst dashboard pattern
- **Login page unchanged** — portal is a separate entry point

## Files to Modify

### 1. `src/app/page.tsx` (replace existing content)

Replace the current minimal landing page with the portal. Server component, no auth required.

**Structure:**
```
Full-screen layout:
├── Background decorations (blurred gradient circles)
├── Header section
│   ├── CDC logo (reuse /cdc-logo-400x400.png)
│   ├── Title: "Cổng thông tin CDC"
│   └── Subtitle: welcome text
├── Card grid (grid-cols-1 sm:grid-cols-2, max-w-3xl centered)
│   ├── CDC LIMS — FlaskConical — blue/indigo — Link to /login
│   ├── CVMEMS — Activity — emerald/teal — https://www.cvmems.vn
│   ├── Quản lý TBYT CDC — Package — amber/orange — https://quan-ly-tbyt.pages.dev/
│   └── Đào tạo nhân lực y tế — GraduationCap — purple/violet — https://daotaoytct.vn
└── Footer (copyright + support contact)
```

**App data array:**
```typescript
const apps = [
  {
    title: "CDC LIMS",
    description: "Hệ thống quản lý thông tin xét nghiệm",
    icon: FlaskConical,
    href: "/login",
    color: "from-blue-500 to-indigo-600",
    iconColor: "text-blue-50",
    external: false,
  },
  {
    title: "CVMEMS",
    description: "Hệ thống quản lý trang thiết bị y tế",
    icon: Activity,
    href: "https://www.cvmems.vn",
    color: "from-emerald-500 to-teal-600",
    iconColor: "text-emerald-50",
    external: true,
  },
  {
    title: "Quản lý TBYT CDC",
    description: "Quản lý thiết bị y tế CDC",
    icon: Package,
    href: "https://quan-ly-tbyt.pages.dev/",
    color: "from-amber-500 to-orange-600",
    iconColor: "text-amber-50",
    external: true,
  },
  {
    title: "Đào tạo nhân lực y tế",
    description: "Hệ thống quản lý đào tạo nhân lực ngành y tế",
    icon: GraduationCap,
    href: "https://daotaoytct.vn",
    color: "from-purple-500 to-violet-600",
    iconColor: "text-purple-50",
    external: true,
  },
]
```

**Card rendering:** Reuse the exact glass-morphism card pattern from `src/app/(dashboard)/analyst/page.tsx:86-122`:
- `bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl`
- Gradient icon badge, hover lift (`hover:-translate-y-1`), hover arrow
- Internal links use Next.js `<Link>`, external links use `<a target="_blank" rel="noopener noreferrer">`
- External cards show a small external link indicator icon (`ExternalLink` from lucide)

### 2. `src/middleware.ts` (lines 184-193)

**Change:** Remove the root route redirect so the portal page renders.

**Before:**
```typescript
// Redirect root to appropriate dashboard or login
if (isRootRoute) {
    const url = request.nextUrl.clone()
    if (user) {
        url.pathname = userRole === 'manager' ? '/manager' : '/analyst'
    } else {
        url.pathname = '/login'
    }
    return NextResponse.redirect(url)
}
```

**After:**

Simply remove the `isRootRoute` redirect block (lines 184-193). The portal page renders for everyone.

**Also update** `isRootRoute` removal from `shouldEnforceTimebox` (line 66):
```typescript
// Before:
const shouldEnforceTimebox = isProtectedRoute || isApiRoute || isRootRoute || isLoginRoute
// After:
const shouldEnforceTimebox = isProtectedRoute || isApiRoute || isLoginRoute
```

The root route no longer needs session timebox enforcement since it's a public page.

The `isRootRoute` variable declaration on line 64 can be removed entirely since it's no longer used.

### 3. `src/app/(dashboard)/profile/page.tsx` (line 43)

**Fix found by architect review (HIGH severity):** The profile page has a "Back to Home" link pointing to `href="/"`. After removing the root redirect, this will navigate to the portal instead of the user's dashboard.

**Before:**
```tsx
<Link href="/">
```

**After:**
```tsx
<Link href={userData.role === 'manager' ? '/manager' : '/analyst'}>
```

The `userData.role` is already available in scope (fetched on line 22).

## Review Findings (Architect + Security)

- **HIGH:** Profile page `href="/"` → must fix (see File 3 above)
- **MEDIUM:** Unnecessary auth queries on root (acceptable — skip optimization for now)
- **MEDIUM:** Missing security headers (pre-existing gap, out of scope)
- **LOW/NONE:** No 21 CFR Part 11 impact, no open redirect risk, no information disclosure concern

## Existing Patterns to Reuse

| Pattern | Source File | Lines |
|---------|------------|-------|
| Glass-morphism card component | `src/app/(dashboard)/analyst/page.tsx` | 86-122 |
| Background decorations (blurred circles) | `src/app/(dashboard)/analyst/page.tsx` | 61-64 |
| CDC logo usage | `src/app/(auth)/login/page.tsx` | Image component with `/cdc-logo-400x400.png` |
| Support contact popover | `src/app/(auth)/login/page.tsx` | Footer section |

## What Does NOT Change

- `src/app/(auth)/login/page.tsx` — unchanged
- `src/app/actions/auth.ts` — auth flow unchanged
- Dashboard pages — unchanged
- No new dependencies
- No database changes

## Verification

1. **Run dev server:** `npm run dev`
2. **Visit `http://localhost:3000`** — should see the portal page with 4 app cards (not a redirect to `/login`)
3. **Click CDC LIMS card** — navigates to `/login` page
4. **Click CVMEMS card** — opens `https://www.cvmems.vn` in a new tab
5. **Click TBYT card** — opens `https://quan-ly-tbyt.pages.dev/` in a new tab
6. **Click Đào tạo card** — opens `https://daotaoytct.vn` in a new tab
7. **Log in via `/login`** — should redirect to dashboard as before
8. **Visit `/` while logged in** — should still see portal (no redirect)
9. **Navigate to Profile → click "Quay lại trang chủ"** — should go to dashboard (not portal)
10. **Run `npm run typecheck`** — no type errors
11. **Run `npm run build`** — successful build

## Agent Mapping for Execution

| Task | Agent Type | Model | Rationale |
|------|------------|-------|-----------|
| Update middleware (remove root redirect) | general-purpose | haiku | Small, surgical edit |
| Fix profile page back link | general-purpose | haiku | Single line change |
| Build portal page component | frontend-developer | sonnet | React component + styling |
| Code review | superpowers:code-reviewer | sonnet | Quality gate |

### Parallelization Groups

- Group 1 (parallel): Middleware update, Profile page fix, Portal page component
- Group 2 (sequential, depends on Group 1): Code review + verification
