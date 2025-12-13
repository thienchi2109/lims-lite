# Mobile-First Accession Page Redesign

## **1. Design Philosophy**
- **Mobile-First & Touch-Friendly**: Targets tablet/mobile (<1280px) users specifically (POS terminals on tablets, quick scan on phones).
- **Native App Feel**: Uses transitions, bottom sheets, and large touch targets to mimic native iOS/Android behavior.
- **Biotech/Clinical Aesthetics**: Clean, sterile white/slate backgrounds with high-contrast text and Sky-700/600 accents for actions.
- **Context-Aware**: Information is progressively disclosed. Users don't need to see "Selected Tests" 100% of the time while searching.

## **2. Layout Strategy: Adaptive Dual-Mode**

### **A. Desktop (>1280px)**
*Maintains the power-user 3-panel density for rapid mouse/keyboard entry.*
- **Left**: Context/Inputs (20%)
- **Center**: Virtualized Data Grid (55%)
- **Right**: Selected Staging/Cart (25%)
- *Enhancement*: Improve `ResizablePanel` constraints to prevent breaking layout on resizing.

### **B. Tablet & Mobile (<1280px)**
*Transforms into a linear flow with accessible overlays.*

#### **Component 1: Sticky Top Bar (Search & Filter)**
- **Sticky Header**: `DashboardHeader` remains, but potentially simplified.
- **Search Bar**: Prominent, full-width or large expandable search bar pinned to top below header.
- **Quick Filters**: Horizontal scrolling chips for "Specimen Type", "Specialty" (e.g., [All] [Biochem] [Micro] [Hematology]).

#### **Component 2: The "Card List" (Replaces Center Grid)**
- **Transformation**: The Data Grid rows transform into rich **Cards**.
- **Card Content**:
  - **Left**: Large Checkbox/Selection indicator (accessible touch target 44x44px).
  - **Middle**: 
    - **Header**: Test Name (Bold, Slate-900).
    - **Sub**: Method (Slate-500, small).
    - **Badge**: Specialty (Color-coded pill).
  - **Right**: "Method" selector (Drop-down becomes a Sheet/Modal trigger on mobile if complex, or inline standard select if simple).
- **Virtualization**: Continue using `tanstack-virtual` but rendering `div` cards instead of `tr`.

#### **Component 3: "Shopping Cart" Bottom Bar (Replaces Right Panel)**
- **Behavior**: Fixed at bottom of screen (z-50).
- **State**:
  - *Empty*: "Choose tests to continue" (Disabled button).
  - *Has Selection*: 
    - Left: "5 tests selected" badge.
    - Right: "Review & Save" Primary Button.
- **Interaction**: Clicking the bar opens a **Sheet (Drawer)** from the bottom.
  - **Sheet Content**: The "Right Panel" content (List of selected tests).
  - **Actions**: "Remove All", "Remove Single", "Confirm Save".

#### **Component 4: Context Drawer (Replaces Left Panel)**
- **Trigger**: A "Sample Info" button or small summary card at the very top.
- **Behavior**: collapsible section or a Drawer that holds:
  - Client Selector
  - Sample Type Selector
  - Date/Time Picker

## **3. Implementation Details**

### **Stack Components (Shadcn UI)**
- `Sheet`: For the "Selected Tests" cart and complex "Filter" menus.
- `Drawer`: Alternative to Sheet for mobile-native feel (pull-to-close).
- `ScrollArea`: For horizontal filter chips.
- `Card`: Base for test items.
- `Button` (Size: `lg`): For touch targets.

### **Responsive Logic (Hook)**
```typescript
const isDesktop = useMediaQuery("(min-width: 1280px)")

return isDesktop ? <ThreePaneLayout /> : <MobileFlowLayout />
```

### **Color Palette (Clinical Pro)**
- **Background**: `bg-slate-50` (App background).
- **Card**: `bg-white` with `shadow-sm`, `border-slate-200`.
- **Selected State**: `bg-sky-50`, `border-sky-200`.
- **Primary Action**: `bg-sky-600` (CDC Blue).
- **Text**: `text-slate-900` (Primary), `text-slate-500` (Secondary).

## **4. Mockup Descriptions**

### **View: Mobile Main**
```
[ Header: < Back | Accession ]
[ Collapsible Card: Sample Info (Client: Benh Vien A...) v ]
[ Sticky: Search Icon | Search Loop... | Filter Button ]
[ Scroll: [All] [Sinh Hoa] [Huyet Hoc] [Vi Sinh] ... ]

[ Card: Glucose (Mau)     ] [ ] (Checkbox)
[ Method: GOD-PAP         ]
---------------------------
[ Card: Urea (Mau)        ] [x] (Checked)
[ Method: Urease UV       ]
---------------------------
[ Card: Creatinine        ] [x] (Checked)
...

[ Bottom Fixed Bar: 2 Tests selected  |  [Review & Create >] ]
```

### **View: Mobile Bottom Sheet (Cart)**
```
[ Handle ]
[ Title: Selected Tests (2)         [Clear All] ]
----------------------------------------------
[ Row: Glucose                     [Trash Icon] ]
[ Row: Urea                        [Trash Icon] ]
----------------------------------------------
[ Button: Confirm Create (Loading...)           ]
```

## **5. Action Plan**
1.  **Refactor `TestAssignmentGrid.tsx`**:
    - Extract `MobileTestCard` component.
    - Extract `MobileBottomBar` component.
    - Implement conditional rendering based on media query.
2.  **Refactor `SampleAccessionForm.tsx`**:
    - Adapt layout to hold the `TestAssignmentGrid` differently on mobile.
    - Move form inputs to a compact header or drawer on mobile.
3.  **Refine CSS**:
    - Ensure virtualizer works with variable heights or fixed card heights.
    - Test `z-index` for sticky overlapping.
