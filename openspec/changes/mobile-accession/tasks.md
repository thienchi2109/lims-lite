# Mobile-First Accession Page Refactor Tasks

## 1. Core Components (Mobile)
- [x] 1.1 **Refactor `MobileTestCard.tsx`**
    - Add `active:scale-[0.99]` animation.
    - Implement `border-l-4 border-sky-500` for selected state.
    - Accommodate method selector as a "More" action (optional).
- [x] 1.2 **Update `MobileFilterBar.tsx`**
    - Ensure it is sticky (`sticky top-0 z-40`).
    - Implement horizontal scroll for Filter Chips (Specialties).
    - Style: Glassmorphism `bg-white/95 backdrop-blur`.
- [x] 1.3 **Update `MobileBottomBar.tsx`**
    - Position `fixed bottom-0 left-0 right-0 z-50`.
    - Add `Review` Sheet trigger.
    - Ensure `pb-safe` for iPhone Home Indicator.

## 2. Layout Integration
- [x] 2.1 **Refactor `TestAssignmentGrid.tsx`**
    - Implement `useMediaQuery("(min-width: 1280px)")`.
    - Render `<table>` for Desktop, `<div>` list for Mobile.
    - Ensure virtualization (TanStack Virtual) works for dynamic height cards on mobile.
- [x] 2.2 **Update `SampleAccessionForm.tsx`**
    - Mobile: Move Client/Sample info to a collapsible `AccessionContextCard` (or simple Drawer).
    - Ensure page padding accounts for the fixed Bottom Bar.

## 3. Data & Interaction
- [ ] 3.1 **Method Selection (Mobile)**
    - If a test has multiple methods, tapping selection should prompt method choice (Sheet or constrained Select).
- [ ] 3.2 **Review Flow**
    - Create the "Review Sheet" in `MobileBottomBar`.
    - Allow deleting items from this list before saving.

## 4. Visual Polish (Pro Max)
- [x] 4.1 **Spacing & Contrast**
    - Verify 44px minimum touch targets.
    - Check contrast ratios for text on `bg-slate-50`.
- [x] 4.2 **Transitions**
    - Add smooth entry/exit animations for the Bottom Bar.
    - Add layout transitions for the Grid list.
