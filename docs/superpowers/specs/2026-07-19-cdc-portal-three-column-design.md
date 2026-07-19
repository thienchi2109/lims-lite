# CDC Portal Three-Column Design

## Context

The public root route at `/` currently presents four CDC applications in a
centered two-column grid. The approved redesign reduces the portal to exactly
three destinations and gives them equal prominence.

Approved Stitch reference:

- Project: `11409838031933628072`
- Screen: `307776d221644359b7adcedd250b957f`
- Title: `Cổng thông tin CDC - 3-Column Layout`

## Hallmark Redesign Profile

- **Audience:** CDC staff selecting an internal system and members of the
  public accessing result lookup.
- **Use case:** choose the correct destination quickly and confidently.
- **Tone:** utilitarian, clinical, authoritative.
- **Genre:** modern-minimal public-service portal.
- **Theme:** custom `Clinical Integrity`, using off-white paper, charcoal ink,
  cool neutral rules, and a restrained CDC teal accent.
- **Typography:** `Be Vietnam Pro` for strong Vietnamese rendering and a
  distinct portal identity without changing the rest of the application.
- **Motion:** no entrance choreography; only targeted hover/press transitions
  with reduced-motion fallbacks.
- **Enrichment:** the existing CDC logo only. No decorative hero imagery.

The approved equal three-column row is an explicit stakeholder override of
Hallmark's default preference for asymmetric feature grids. To keep the result
from reading like a generic feature section, cards remain left-aligned, the
icon sits within the information flow, action labels stay on one line, and the
page uses a compact institutional masthead rather than a centered marketing
hero.

## Decision

The approved Stitch screen defines a wide, restrained institutional layout:

- a compact identity header with the existing CDC logo, portal title, and
  organization name;
- a content container up to `1360px` wide, expanding substantially beyond the
  current `max-w-2xl` layout while retaining readable outer margins on very
  wide displays;
- three equal-height destination cards in one horizontal row on desktop;
- one stacked column below the desktop breakpoint so mobile users can scroll
  the page normally;
- white cards, cool neutral borders, charcoal text, and a restrained CDC teal
  accent;
- no gradients, glassmorphism, glowing decorations, or nested cards.

Each card uses the same vertical structure: icon, title, description, and a
bottom-aligned action row. The entire card remains clickable.

## Portal Destinations

The page contains exactly these destinations:

1. `CDC LIMS`
   - Description: `Hệ thống quản lý thông tin xét nghiệm`
   - URL: `/login`
2. `Quản lý TBYT CDC`
   - Description: `Quản lý thiết bị y tế CDC`
   - URL: `https://quan-ly-tbyt.pages.dev/`
3. `Cổng tra cứu kết quả xét nghiệm`
   - Description: `Tra cứu và xác thực phiếu kết quả xét nghiệm`
   - URL: `https://cdclims.cloud/coa/access`

The page must not contain `CVMEMS`, `Đào tạo nhân lực y tế`, `Cổng dịch vụ
công`, or any additional portal destination.

## Responsive Behavior

- Desktop (`lg` and wider): three equal columns in one row.
- Smaller viewports: one column in priority order.
- Mobile: normal document scrolling, no fixed-height clipping, and no
  `overflow-hidden` boundary that prevents reaching the third card or footer.
- Card titles may wrap, but equal-height cards and bottom action alignment must
  remain stable on desktop.

## Scope

Modify only:

- `src/app/page.tsx`
- `src/__tests__/portal-root-route.test.ts`

The login page, middleware behavior, authentication flow, database, and
dashboard pages remain unchanged.

## Testing

Focused regression coverage will verify:

- exactly three destination records in the approved order, including their
  titles, descriptions, URLs, and internal/external behavior;
- removal of the three explicitly excluded labels;
- the exact `grid-cols-1 lg:grid-cols-3` layout contract without an intermediate
  two-column breakpoint;
- a dynamic viewport minimum height without root overflow clipping;
- existing public-route and `noindex` behavior.

Run the focused test, TypeScript typecheck, lint, React Doctor, and rendered
desktop/mobile browser checks. At `1440x900`, verify the three cards share the
same top position, width, and row. At `390x844`, verify one-column ordering, no
horizontal overflow, normal document scrolling, and that the third card and
footer remain reachable.
