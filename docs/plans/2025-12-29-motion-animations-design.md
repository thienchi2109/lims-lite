# Motion Animations Design for CDC-LIMS

**Date:** 2025-12-29
**Status:** Approved
**Library:** Motion (framer-motion successor)

## Overview

Add polished animations to CDC-LIMS to improve user experience with visual feedback for workflow actions, status changes, and navigation. Focus on "smooth & reassuring" style (250-350ms durations) appropriate for a professional lab environment.

## Priority Order

1. Status badge transitions (pulse + color morph)
2. Table row highlight on update
3. Sample panel animations (fade-in-scale, content crossfade)
4. Dialog open/close animations
5. Page transitions (simple crossfade)

## Animation Style

- **Durations:** 150ms (fast), 250ms (normal), 350ms (slow)
- **Easing:** Gentle spring physics, smooth easeOut for entrances
- **Philosophy:** Subtle feedback without distraction, professional feel

---

## 1. Animation Foundation

Create shared constants and variants in `src/lib/motion.ts`:

```typescript
// Timing presets
export const durations = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.35,
}

export const easings = {
  ease: [0.25, 0.1, 0.25, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  spring: { type: "spring", stiffness: 300, damping: 25 },
}

// Reusable variants
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}
```

---

## 2. Status Badge Animations

**Components:** `SampleStatusBadge`, `ResultStatusBadge`

**Behavior:**
- When status prop changes → badge pulses (scale 1 → 1.05 → 1)
- Background/text color morphs via CSS transition (0.25s)
- No animation on initial render

**Implementation:**
```tsx
import { motion } from "motion/react"
import { useEffect, useRef } from "react"

export function SampleStatusBadge({ status }: Props) {
  const prevStatus = useRef(status)
  const hasChanged = prevStatus.current !== status

  useEffect(() => {
    prevStatus.current = status
  }, [status])

  return (
    <motion.span
      className={cn(badgeBaseStyles, statusStyles[status])}
      animate={hasChanged ? {
        scale: [1, 1.05, 1],
        transition: { duration: 0.3 }
      } : {}}
      style={{ transition: "background-color 0.25s, color 0.25s" }}
    >
      {statusLabels[status]}
    </motion.span>
  )
}
```

---

## 3. Table Row Highlight Animation

**Component:** `SampleListTable`

**Behavior:**
- Compare `updated_at` timestamps between renders
- Changed rows get yellow highlight that fades out (0.8s)
- No animation on initial load or pagination

**Implementation:**
```tsx
// Custom hook to track updated rows
function useUpdatedRows(samples: SampleWithUser[]) {
  const prevTimestamps = useRef<Map<string, string>>(new Map())
  const updatedIds = new Set<string>()

  samples.forEach(sample => {
    const prev = prevTimestamps.current.get(sample.id)
    if (prev && prev !== sample.updated_at) {
      updatedIds.add(sample.id)
    }
  })

  useEffect(() => {
    const newMap = new Map<string, string>()
    samples.forEach(s => newMap.set(s.id, s.updated_at))
    prevTimestamps.current = newMap
  }, [samples])

  return updatedIds
}

// In table body
<motion.tr
  key={sample.id}
  initial={false}
  animate={{
    backgroundColor: updatedRows.has(sample.id)
      ? ["rgb(254 249 195)", "transparent"]
      : undefined
  }}
  transition={{ duration: 0.8, ease: "easeOut" }}
>
```

---

## 4. Sample Panel Animations

**Component:** `SampleBottomRow`

**Behavior:**
- **First visit:** Empty placeholder (no panels)
- **First sample selected:** Panels pop in (90% → 100% scale + fade)
- **Right panel staggers:** 50ms delay
- **Switching samples:** Content crossfades
- **Deselect:** Content fades to placeholder, panels remain

**Implementation:**
```tsx
import { motion, AnimatePresence } from "motion/react"

export function SampleBottomRow({ sample, ... }: Props) {
  const hasShownPanels = useRef(false)

  if (sample && !hasShownPanels.current) {
    hasShownPanels.current = true
  }

  if (!hasShownPanels.current && !sample) {
    return <EmptyPlaceholder />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={sample?.id ?? "empty"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <SampleDetailPanel sample={sample} />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, delay: 0.05 }}
      >
        {/* Same AnimatePresence pattern for AssignedTestsPanel */}
      </motion.div>
    </div>
  )
}
```

---

## 5. Dialog Animations

**Component:** `src/components/ui/dialog.tsx`

**Behavior:**
- **Open:** Backdrop fades (150ms), content pops (90% → 100%, 250ms)
- **Close:** Content scales down (95%) + fades, backdrop fades
- **Accessibility:** Radix handles focus trap, ESC, click-outside

**Implementation:**
```tsx
// DialogContent - wrap with motion.div
<DialogPrimitive.Content asChild {...props}>
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
</DialogPrimitive.Content>

// DialogOverlay - wrap with motion.div
<DialogPrimitive.Overlay asChild {...props}>
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
  />
</DialogPrimitive.Overlay>
```

**Also apply to:** Sheet, Drawer (slide from edge instead of scale)

---

## 6. Page Transitions

**Component:** `src/components/page-transition.tsx`

**Behavior:**
- Route change: Current page fades out (150ms), new fades in (150ms)
- Sidebar/Header stay static
- Total transition ~300ms

**Implementation:**
```tsx
'use client'
import { motion, AnimatePresence } from "motion/react"
import { usePathname } from "next/navigation"

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

**Integration:** Wrap `{children}` in dashboard layout with `<PageTransition>`.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/motion.ts` | Create - animation constants |
| `src/components/sample-status-badge.tsx` | Modify - add pulse animation |
| `src/components/result-status-badge.tsx` | Modify - add pulse animation |
| `src/components/sample-list-table.tsx` | Modify - add row highlight |
| `src/components/sample-bottom-row.tsx` | Modify - panel animations |
| `src/components/ui/dialog.tsx` | Modify - Motion wrapper |
| `src/components/ui/sheet.tsx` | Modify - slide animation |
| `src/components/page-transition.tsx` | Create - route wrapper |
| `src/app/(dashboard)/layout.tsx` | Modify - integrate PageTransition |

---

## Testing Checklist

- [ ] Status badge pulses on status change (not on initial render)
- [ ] Table row highlights yellow then fades when updated
- [ ] Bottom panels pop in on first sample selection
- [ ] Content crossfades when switching samples
- [ ] Dialogs animate open/close smoothly
- [ ] Page transitions feel smooth, no flash
- [ ] No performance issues with 20+ table rows
- [ ] Animations respect `prefers-reduced-motion`

---

## Future Enhancements (Out of Scope)

- Toast/notification animations
- KPI card number counting animations
- Chart entrance animations
- Loading skeleton shimmer effects
