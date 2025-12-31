# View Transitions API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken Motion-based PageTransition component with the native View Transitions API for smooth page transitions in Next.js App Router.

**Architecture:** Enable the experimental `viewTransition` flag in Next.js config, add CSS-based view transition styles to globals.css, and optionally wrap page content with React's `<ViewTransition>` component for fine-grained control.

**Tech Stack:** Next.js 16, React 19.2 (ViewTransition component), CSS View Transitions API

---

## Background

The previous `PageTransition` component using Motion's `AnimatePresence` caused infinite render loops in Next.js App Router due to:
- `usePathname()` triggering constant remounts with `key={pathname}`
- `AnimatePresence mode="wait"` conflicting with App Router's streaming/partial rendering

The View Transitions API is the recommended solution for Next.js 16 / React 19.2.

---

## Task 1: Enable View Transitions in Next.js Config

**Files:**
- Modify: `next.config.ts:7-18`

**Step 1: Add viewTransition flag to experimental config**

Open `next.config.ts` and add `viewTransition: true` to the experimental object:

```typescript
const nextConfig: NextConfig = {
  /* config options here */
  // Disable React Compiler for now due to invalid sourcemap noise in dev on Windows
  reactCompiler: false,
  experimental: {
    // Enable View Transitions API for smooth page transitions
    viewTransition: true,
    // Disable server source maps to avoid noisy invalid sourcemap warnings on Windows/dev
    serverSourceMaps: false,
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        ...(process.env.CODESPACE_NAME
          ? [`${process.env.CODESPACE_NAME}-3000.app.github.dev`]
          : [])
      ],
    },
  },
  // Enable standalone output for Docker deployments
  output: 'standalone',
};
```

**Step 2: Verify dev server starts without errors**

Run: `npm run dev`
Expected: Server starts successfully, no errors about viewTransition

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable experimental View Transitions API

Adds viewTransition: true to next.config.ts experimental options
for native browser page transition support in App Router.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add View Transition CSS Styles

**Files:**
- Modify: `src/app/globals.css:147` (after existing utilities)

**Step 1: Add view transition CSS rules**

Add the following CSS after the existing `@layer utilities` block (before `@layer base`):

```css
/* View Transitions API - Page Transitions */
@layer utilities {
  /* ... existing utilities ... */
}

/* View Transition Animations */
::view-transition-old(root) {
  animation: fade-out 150ms ease-out forwards;
}

::view-transition-new(root) {
  animation: fade-in 150ms ease-in forwards;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Optional: Slide transition variant for specific elements */
::view-transition-old(page-content) {
  animation: slide-out-left 200ms ease-out forwards;
}

::view-transition-new(page-content) {
  animation: slide-in-right 200ms ease-in forwards;
}

@keyframes slide-out-left {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-20px); }
}

@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
```

**Step 2: Verify CSS compiles without errors**

Run: `npm run dev`
Expected: No CSS compilation errors, dev server running

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add View Transition CSS animations

Adds CSS rules for ::view-transition-old and ::view-transition-new
pseudo-elements with fade and optional slide animations.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Test View Transitions in Browser

**Files:**
- None (manual testing)

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Open browser and navigate between pages**

1. Open http://localhost:3000
2. Log in as analyst or manager
3. Navigate between pages: Samples → Reports → Profile
4. Observe: Pages should fade in/out smoothly during navigation

**Step 3: Verify in browser DevTools**

1. Open Chrome DevTools → Performance tab
2. Record while navigating between pages
3. Check: No infinite render loops, smooth 60fps transitions

**Step 4: Test browser compatibility**

View Transitions API support:
- Chrome 111+ ✅
- Edge 111+ ✅
- Safari 18+ ✅ (partial)
- Firefox: Not yet (graceful fallback - instant navigation)

---

## Task 4: Update Motion Config (Cleanup)

**Files:**
- Modify: `src/lib/motion.ts:118-125`

**Step 1: Deprecate pageTransition constant**

Update the `pageTransition` export with a deprecation comment:

```typescript
/**
 * Page transition (simple crossfade)
 * @deprecated Use View Transitions API instead (enabled in next.config.ts)
 * This was used with PageTransition component which caused infinite render loops.
 */
export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: durations.fast },
} as const
```

**Step 2: Commit**

```bash
git add src/lib/motion.ts
git commit -m "docs: deprecate pageTransition constant

Mark pageTransition as deprecated in favor of View Transitions API.
Kept for reference but no longer used.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Optional - Add ViewTransition Component Wrapper

**Files:**
- Create: `src/components/view-transition-wrapper.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Note:** This task is optional. The View Transitions API works automatically with `next/link` navigation. Only implement if you need fine-grained control over which elements participate in transitions.

**Step 1: Create ViewTransition wrapper component**

```typescript
'use client'

import { ViewTransition } from 'react'
import type { ReactNode } from 'react'

interface ViewTransitionWrapperProps {
  children: ReactNode
  name?: string
}

/**
 * Wrapper for React's ViewTransition component
 *
 * Usage:
 * - Wrap page content to participate in view transitions
 * - Use `name` prop to create named view transition groups
 *
 * @example
 * <ViewTransitionWrapper name="page-content">
 *   {children}
 * </ViewTransitionWrapper>
 */
export function ViewTransitionWrapper({ children, name }: ViewTransitionWrapperProps) {
  return (
    <ViewTransition name={name}>
      {children}
    </ViewTransition>
  )
}
```

**Step 2: Optionally add to dashboard layout**

```typescript
import type { ReactNode } from 'react'
import { SessionTimeboxGuard } from '@/components/auth/session-timebox-guard'
import { WalkthroughWrapper } from '@/components/walkthrough'
import { ViewTransitionWrapper } from '@/components/view-transition-wrapper'

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <WalkthroughWrapper>
            <SessionTimeboxGuard />
            <ViewTransitionWrapper name="page-content">
                {children}
            </ViewTransitionWrapper>
        </WalkthroughWrapper>
    )
}
```

**Step 3: Commit**

```bash
git add src/components/view-transition-wrapper.tsx src/app/\(dashboard\)/layout.tsx
git commit -m "feat: add ViewTransition wrapper for fine-grained control

Optional wrapper component using React's ViewTransition for
named transition groups. Enables slide transitions for page content.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Final Verification and Cleanup

**Files:**
- None (verification only)

**Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Test production build**

Run: `npm run start`
Navigate between pages and verify transitions work in production mode.

**Step 4: Push all changes**

```bash
git push
```

---

## Rollback Plan

If View Transitions cause issues:

1. Remove `viewTransition: true` from `next.config.ts`
2. Remove view transition CSS from `globals.css`
3. Pages will navigate instantly (no transition, but functional)

The old `page-transition.tsx` component is kept for reference but should NOT be re-enabled due to the infinite render loop issue.

---

## Browser Fallback Behavior

For browsers without View Transitions API support:
- Navigation works normally (instant, no animation)
- No JavaScript errors
- Progressive enhancement - users get transitions if browser supports it
