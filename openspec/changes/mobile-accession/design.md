# Mobile-First Accession Page Design Specification (UI/UX Pro Max)

## **1. Executive Summary**
This redesign transforms the desktop-centric "POS" test assignment interface into a **responsive, native-app-like experience** for tablet and mobile devices (<1280px). 
The goal is to enable rapid sample accessioning and test assignment on handheld devices (iPad/Android tablets) used in phlebotomy or sample reception areas.

**Core Philosophy:** "Clinical Minimalism"
- **Cleanliness**: High whitespace, `slate-50` backgrounds, clear hierarchy.
- **Speed**: Large touch targets (>44px), sticky controls, fewer clicks.
- **Focus**: Progressive disclosure of information (hide complex filters until needed).

## **2. Design System & Tokens**

### **Color Palette (Clinical Sky)**
| Token | Tailwind Class | Hex | Usage |
|-------|----------------|-----|-------|
| **Background** | `bg-slate-50` | `#F8FAFC` | App background (Mobile) |
| **Surface** | `bg-white` | `#FFFFFF` | Cards, Bottom Bar, Header |
| **Primary** | `bg-sky-600` | `#0284C7` | Primary Actions, Checked States |
| **Primary-Sub** | `bg-sky-50` | `#F0F9FF` | Selected Row/Card Background |
| **Border** | `border-slate-200` | `#E2E8F0` | Dividers, Card Borders |
| **Text-Main** | `text-slate-900` | `#0F172A` | Test Names, Headers |
| **Text-Muted** | `text-slate-500` | `#64748B` | Methods, Metadata |
| **Text-Tiny** | `text-slate-400` | `#94A3B8` | Codes, IDs |

### **Typography**
- **Font**: Inter (System Default)
- **Headers**: `text-base font-semibold tracking-tight`
- **Body**: `text-sm font-medium`
- **Meta**: `text-xs lg:text-[13px] text-slate-500`

### **Layout Breakpoints**
- **Desktop (>1280px)**: 3-Panel Fixed Layout (Context | Grid | Cart).
- **Mobile/Tablet (<1280px)**: Single Column Flow with Fixed Top/Bottom Bars.

## **3. Mobile UI Components**

### **A. Sticky Context Header (Top Bar)**
*Pins to the top, providing global actions and quick filters.*
- **Z-Index**: `z-40`
- **Content**:
  1. **Search Input**: Full width or expanded. `h-10`, `rounded-full` or `rounded-md`.
  2. **Filter Chips**: Horizontal ScrollView.
     - `[Tất cả]` (Active: `bg-slate-900 text-white`)
     - `[Sinh hóa]` (Default: `bg-white border border-slate-200`)
     - `[Huyết học]`
  3. **View Toggle**: (Optional) Switch between "List" and "Grid" if needed.

### **B. Test Card (The List Item)**
*Replaces the Data Grid Row. Optimized for thumb interactions.*
- **Container**: `p-4 bg-white border-b border-slate-100 active:bg-slate-50`
- **Interaction**: Entire card is tappable.
- **Visual States**:
  - **Default**: White background.
  - **Selected**: `bg-sky-50/60`, Border-l-4 `border-l-sky-500` (Visual indicator).
- **Anatomy**:
  ```
  [ Checkbox (24px) ]  [ Test Name (Bold)        Badge (Specialty) ]
                       [ Method (Muted)                            ]
  ```
- **Method Selector**: logic simplifies on mobile. If >1 method, show "Dropdown" icon or "More" menu triggering a bottom drawer selector.

### **C. Accession Context Card**
*Collapsible section at the top of the list.*
- **State**: Collapsed by default after Client is selected to save space.
- **Content**: Client Name, Sample Type, Received Date.
- **Edit Action**: Opens full `AccessionInfoCard` form in a Drawer.

### **D. "Shopping Cart" Bottom Bar**
*Fixed footer for managing the 'Selection' state.*
- **Position**: Fixed `bottom-0`, `left-0`, `right-0`.
- **Z-Index**: `z-50`
- **Style**: `bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]`
- **Content**:
  - **Left**: "5 Tests Selected" (Typography: `font-semibold text-sky-700`).
  - **Right**: Button `[Review & Assign >]`.
- **Transition**: Slide up when selection > 0.

### **E. Review Sheet (Bottom Sheet)**
*Triggered by the Bottom Bar 'Review' button.*
- **Component**: `Sheet` (Shadcn) with `side="bottom"`.
- **Content**: 
  - List of selected tests (Compact view).
  - Ability to remove items.
  - Final "Confirm" button (`w-full`, `h-12`, `text-lg`).

## **4. Interaction Flow (Mobile)**

1.  **Start**: User lands on page. Header & Search visible.
2.  **Context**: User selects "Client" (Popup/Drawer).
3.  **Search**: User taps Search, types "Glu". List filters instantly.
4.  **Select**: User taps "Glucose". 
    - Card turns Blue (`bg-sky-50`).
    - Bottom Bar slides up: "1 Selected".
5.  **Refine**: User scrolls horizontal chips, taps "Huyết học". List updates.
6.  **Review**: User taps "Review & Assign" on Bottom Bar.
    - Sheet opens. User checks list.
7.  **Commit**: User taps "Confirm". loading state -> Success Toast.

## **5. Technical Implementation Plan**

### **Phase 1: Component Construction**
- [ ] **`MobileTestCard.tsx`**: Enhance existing component with `active:scale-[0.99]` feedback and proper spacing.
- [ ] **`MobileFilterBar.tsx`**: Implement sticky header with horizontal scroll area for specialty badges.
- [ ] **`MobileBottomBar.tsx`**: Implement the fixed footer with distinct "Review" state.

### **Phase 2: Layout Integration**
- [ ] **`TestAssignmentGrid.tsx`**:
  - Use `useMediaQuery` to switch between `<table>` (Desktop) and `virtuoso`/`map` (Mobile).
  - *Note*: TanStack Virtual is preferred for performance if list > 50 items.
- [ ] **`SampleAccessionForm.tsx`**:
  - Restructure flex layout to ensure Bottom Bar sits above mobile browser chrome.

### **Phase 3: Refinement**
- [ ] **Touch Targets**: Ensure all clickable zones are min 44x44px.
- [ ] **SafeArea**: Handle iPhone "Home Indicator" spacing in Bottom Bar (`pb-safe`).
- [ ] **Testing**: Verify on actual mobile device or Simulator.
