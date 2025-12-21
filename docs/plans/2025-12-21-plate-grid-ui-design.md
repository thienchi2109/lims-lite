# 96-Well Plate Grid UI Design

**Date:** 2025-12-21
**Status:** Approved
**Author:** Claude (Brainstorming Session)

## Overview

Design for a 96-well plate runsheet UI component that allows lab technicians to assign samples to a 2D array (8 rows × 12 columns), mirroring physical microplate layouts.

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Grid Rendering | CSS Grid | Native, no library needed, 96 wells don't need virtualization |
| Selection Model | Array-based | Preserves selection order for assignment mapping |
| Keyboard Navigation | Roving tabindex | WAI-ARIA Grid pattern, Tab exits grid |
| Sample Assignment | Click-to-assign | Simple, touch-friendly, batch-efficient |
| Color Coding | Semantic | Blue/Green/Yellow/Red - intuitive meaning |
| Well Content | Minimal | Position when empty, color when assigned, tooltip on hover |
| Selection Visual | Ring outline | Clear, consistent with shadcn/ui patterns |
| Fill Direction | User toggle | Row default, column option for multichannel pipettes |

## Component Architecture

```
PlateGridEditor (Container)
├── PlateToolbar
│   ├── AssaySelector (dropdown)
│   ├── MethodSelector (dropdown)
│   ├── FillDirectionToggle (row/column)
│   ├── WellTypeSelector (for selected wells)
│   └── ActionButtons (Assign, Clear, Save)
│
├── MainContent (ResizablePanelGroup)
│   ├── SamplePickerPanel (left, ~300px)
│   │   ├── SearchInput
│   │   ├── VirtualizedSampleList
│   │   └── SelectedCount badge
│   │
│   └── PlateGridPanel (center, flex-1)
│       ├── ColumnHeaders (1-12)
│       ├── PlateGrid (8x12 CSS Grid)
│       │   ├── RowHeader (A-H, clickable)
│       │   └── WellCell × 96
│       └── WellLegend (bottom)
│
└── StatusBar
    └── Selection info, dirty state indicator
```

## State Management

```typescript
interface PlateEditorState {
  // Grid state
  wells: Map<string, WellState>      // 'A1' -> WellState
  focusedWell: string | null         // Current keyboard focus
  selectedWells: string[]            // Ordered array for assignment

  // Picker state
  selectedSamples: EligibleSample[]  // Ordered array from picker
  sampleSearchQuery: string

  // Settings
  fillDirection: 'row' | 'column'

  // UI state
  isDirty: boolean
  isSaving: boolean
}

interface WellState {
  resultId: string | null
  sampleIdDisplay: string | null
  wellType: 'empty' | 'sample' | 'blank' | 'standard' | 'control'
  concentration: number | null       // For standards
  isExcluded: boolean
  exclusionReason: string | null
}

interface EligibleSample {
  resultId: string
  sampleId: string                   // Display ID (e.g., "MAU-001")
  receivedAt: string
}
```

**Pattern:** Use `useReducer` instead of multiple `useState` for complex state updates.

## Visual Design

### Well Cell Styling

```typescript
const wellStyles = {
  base: 'w-11 h-11 rounded-sm text-xs font-mono flex items-center justify-center cursor-pointer transition-all',

  // Well types (Semantic colors)
  empty:    'bg-gray-100 text-gray-400',
  sample:   'bg-blue-400 text-white',
  blank:    'bg-slate-200 text-slate-600',
  standard: 'bg-green-400 text-white',
  control:  'bg-yellow-400 text-yellow-900',
  excluded: 'bg-red-400 text-white line-through opacity-60',

  // States
  selected: 'ring-2 ring-blue-600',
  focused:  'ring-2 ring-blue-600 ring-offset-2',
  hover:    'brightness-110',
}
```

### Well Content Display

- **Empty well**: Show position ("A1", "B2"...) in gray
- **Assigned well**: Show only background color by type
- **Hover**: Tooltip with full details (Sample ID, type, concentration)

### Tooltip Content

```
┌─────────────────────┐
│ Position: A1        │
│ Sample: MAU-001     │
│ Type: Mẫu chuẩn     │
│ Concentration: 10.5 │
└─────────────────────┘
```

## Interaction Matrix

| Action | Behavior |
|--------|----------|
| Click | Select single well (clear others) |
| Ctrl+Click | Toggle well in selection |
| Shift+Click | Range select from last selected |
| Click Row Header (A-H) | Select entire row |
| Click Column Header (1-12) | Select entire column |
| Arrow Keys | Move focus |
| Space/Enter | Toggle selection on focused well |
| Escape | Clear selection |
| Delete | Clear selected wells |

## Assignment Workflow

### Bidirectional Assignment

**Workflow A: Wells First**
1. User clicks/selects wells: A1, A2, A3 (in order)
2. User clicks samples in picker: S1, S2, S3 (in order)
3. Click "Gán mẫu" button
4. Result: A1←S1, A2←S2, A3←S3

**Workflow B: Samples First**
1. User clicks samples in picker: S1, S2, S3 (in order)
2. User clicks/selects wells: B1, B2, B3 (in order)
3. Click "Gán mẫu" button
4. Result: B1←S1, B2←S2, B3←S3

### Overflow Handling

- If wells > samples: Only assign to first N wells
- If samples > wells: Only assign first N samples
- Show warning badge if counts don't match

## Keyboard Navigation (Roving Tabindex)

```typescript
const [focusedPosition, setFocusedPosition] = useState<string>('A1')

const posToIndices = (pos: string) => ({
  row: pos.charCodeAt(0) - 65,  // A=0, B=1, ...H=7
  col: parseInt(pos.slice(1)) - 1  // 1=0, 2=1, ...12=11
})

const indicesToPos = (row: number, col: number) =>
  `${String.fromCharCode(65 + row)}${col + 1}`

const handleKeyDown = (e: KeyboardEvent) => {
  const { row, col } = posToIndices(focusedPosition)

  switch(e.key) {
    case 'ArrowUp':    moveFocus(row - 1, col); break
    case 'ArrowDown':  moveFocus(row + 1, col); break
    case 'ArrowLeft':  moveFocus(row, col - 1); break
    case 'ArrowRight': moveFocus(row, col + 1); break
    case ' ':
    case 'Enter':      toggleSelection(focusedPosition); break
    case 'Escape':     clearSelection(); break
  }
}

const moveFocus = (row: number, col: number) => {
  const newRow = Math.max(0, Math.min(7, row))   // Clamp 0-7
  const newCol = Math.max(0, Math.min(11, col))  // Clamp 0-11
  setFocusedPosition(indicesToPos(newRow, newCol))
}
```

**ARIA Roles:**
- Grid container: `role="grid"`
- Wells: `role="gridcell"`
- Tab exits grid, Shift+Tab enters from end

## Sample Picker Panel

```
┌─────────────────────────────┐
│ 🔍 Tìm mẫu...              │  ← SearchInput
├─────────────────────────────┤
│ Đã chọn: 3 mẫu    [Bỏ chọn]│  ← Selection header
├─────────────────────────────┤
│ ☑ MAU-001  •  15/12  Máu   │  ← VirtualizedList
│ ☑ MAU-002  •  15/12  Nước  │     (@tanstack/react-virtual)
│ ☐ MAU-003  •  14/12  Phân  │
│ ...                         │
└─────────────────────────────┘
```

**Features:**
- Virtualized list for performance (100+ samples)
- Search filters by sample ID
- Selection order indicator (Badge "1", "2", "3"...)
- Click anywhere on row to toggle

## Toolbar Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Xét nghiệm: [Glucose ▼]   Phương pháp: [Enzymatic ▼]   Hướng: [⇢ Hàng ▼]│
├──────────────────────────────────────────────────────────────────────────┤
│ [Gán 5 mẫu]  [Xóa chọn]  [Loại: ▼]  │           [Lưu nháp]  [Hủy bỏ]  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Action Buttons:**

| Button | Condition | Action |
|--------|-----------|--------|
| Gán mẫu | wells + samples selected | Map samples → wells by order |
| Xóa chọn | wells selected | Clear assignments, reset to empty |
| Loại well | wells selected | Set type: Blank, Standard, Control |
| Lưu nháp | isDirty = true | Save to database |
| Hủy bỏ | always | Confirm if dirty, navigate back |

## File Structure

```
src/components/runsheet/
├── plate-grid-editor.tsx      # Main container with state management
├── plate-grid.tsx             # 8x12 CSS grid component
├── well-cell.tsx              # Individual well with interactions
├── sample-picker.tsx          # Left panel with virtualized list
├── plate-toolbar.tsx          # Top action bar
├── well-legend.tsx            # Color coding legend
└── use-plate-keyboard.ts      # Keyboard navigation hook
```

## Vietnamese Translations

| English | Vietnamese |
|---------|------------|
| Plate Grid | Khay 96 giếng |
| Well | Giếng |
| Assign samples | Gán mẫu |
| Clear selection | Xóa chọn |
| By row | Theo hàng |
| By column | Theo cột |
| Blank | Mẫu trắng |
| Standard | Mẫu chuẩn |
| Control | Mẫu QC |
| Save draft | Lưu nháp |
| Cancel | Hủy bỏ |
