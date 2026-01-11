# QC Page Client Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `quality-control-page-client.tsx` from 464 lines to ~220 lines by extracting tab content into separate components.

**Architecture:** Extract 4 tab content components (Materials, Definitions, Sessions, Violations) into standalone files. Each component owns its Card wrapper, header, and child components. Parent retains orchestration, header, stats, tabs shell, and shared dialogs.

**Tech Stack:** React 19, TypeScript, Shadcn UI

---

## Task 1: Extract QCViolationsTabContent

**Files:**
- Create: `src/components/qc/qc-violations-tab-content.tsx`
- Modify: `src/components/qc/quality-control-page-client.tsx`

**Step 1: Create the violations tab content component**

Create `src/components/qc/qc-violations-tab-content.tsx`:

```typescript
'use client'

import { Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ViolationResolutionDialog } from './violation-resolution-dialog'
import type { PendingViolation } from './qc-overview-tab'

interface QCViolationsTabContentProps {
    violations: PendingViolation[]
}

export function QCViolationsTabContent({ violations }: QCViolationsTabContentProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Vi phạm QC</CardTitle>
                <CardDescription>
                    Danh sách vi phạm quy tắc Westgard cần xử lý
                </CardDescription>
            </CardHeader>
            <CardContent>
                <QCViolationsList violations={violations} />
            </CardContent>
        </Card>
    )
}

function QCViolationsList({ violations }: { violations: PendingViolation[] }) {
    if (violations.length === 0) {
        return (
            <div className="text-center py-12 text-green-600">
                <Activity className="h-12 w-12 mx-auto mb-4" />
                <p className="font-medium">Không có vi phạm nào chờ xử lý</p>
                <p className="text-sm text-muted-foreground">
                    Tất cả các phiên QC đang hoạt động bình thường
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {violations.map((violation) => (
                <div
                    id="tour-iqc-mgr-resolve"
                    key={violation.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20"
                >
                    <div className="space-y-1">
                        <div className="font-medium text-red-700">
                            {violation.assay_name}
                        </div>
                        <div className="text-sm text-red-600">
                            {violation.material_name} - {violation.material_level}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Quy tắc vi phạm: <strong>{violation.rule_violated}</strong> |
                            Giá trị: {violation.value} |
                            Z-score: {violation.z_score.toFixed(2)}
                        </div>
                    </div>
                    <ViolationResolutionDialog
                        violation={{
                            id: violation.id,
                            rule_violated: violation.rule_violated as any,
                            z_score_at_violation: violation.z_score,
                            value: violation.value,
                            mean: violation.mean,
                            sd: violation.sd,
                            assay_name: violation.assay_name,
                            created_at: violation.created_at,
                        }}
                        trigger={
                            <Button variant="destructive" size="sm">
                                Xử lý vi phạm
                            </Button>
                        }
                        onSuccess={() => window.location.reload()}
                    />
                </div>
            ))}
        </div>
    )
}
```

**Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/qc/qc-violations-tab-content.tsx
git commit -m "refactor(qc): extract QCViolationsTabContent component"
```

---

## Task 2: Extract QCSessionsTabContent

**Files:**
- Create: `src/components/qc/qc-sessions-tab-content.tsx`

**Step 1: Create the sessions tab content component**

Create `src/components/qc/qc-sessions-tab-content.tsx`:

```typescript
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QCSessionsTable } from './qc-sessions-table'
import type { QCSessionRow } from '@/types/qc'

interface Specialty {
    id: string
    name: string
}

interface Assay {
    id: string
    name: string
    units: string | null
    specialty_id: string | null
}

interface QCSessionsTabContentProps {
    specialties: Specialty[]
    assays: Assay[]
    sessionsData: QCSessionRow[]
    sessionsTotal: number
    sessionsTotalPages: number
    sessionsPage: number
    sessionsPageSize: number
}

export function QCSessionsTabContent({
    specialties,
    assays,
    sessionsData,
    sessionsTotal,
    sessionsTotalPages,
    sessionsPage,
    sessionsPageSize,
}: QCSessionsTabContentProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Quản lý phiên QC</CardTitle>
                <CardDescription>
                    Xem, lọc và quản lý tất cả các phiên QC
                </CardDescription>
            </CardHeader>
            <CardContent>
                <QCSessionsTable
                    specialties={specialties}
                    assays={assays.map(a => ({ id: a.id, name: a.name }))}
                    initialData={{
                        data: sessionsData,
                        total: sessionsTotal,
                        page: sessionsPage,
                        page_size: sessionsPageSize,
                        total_pages: sessionsTotalPages,
                    }}
                />
            </CardContent>
        </Card>
    )
}
```

**Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/qc/qc-sessions-tab-content.tsx
git commit -m "refactor(qc): extract QCSessionsTabContent component"
```

---

## Task 3: Extract QCDefinitionsTabContent

**Files:**
- Create: `src/components/qc/qc-definitions-tab-content.tsx`

**Step 1: Create the definitions tab content component**

Create `src/components/qc/qc-definitions-tab-content.tsx`:

```typescript
'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QCDefinitionsTable, type QCDefinitionWithDetails } from './qc-definitions-table'

interface QCDefinitionsTabContentProps {
    definitions: QCDefinitionWithDetails[]
    total: number
    page: number
    pageSize: number
    onEstablishLimits: () => void
}

export function QCDefinitionsTabContent({
    definitions,
    total,
    page,
    pageSize,
    onEstablishLimits,
}: QCDefinitionsTabContentProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Giới hạn kiểm soát</CardTitle>
                        <CardDescription>
                            Cấu hình Mean và SD cho từng xét nghiệm
                        </CardDescription>
                    </div>
                    <Button size="sm" onClick={onEstablishLimits}>
                        <Plus className="h-4 w-4 mr-2" />
                        Thiết lập mới
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <QCDefinitionsTable
                    definitions={definitions}
                    total={total}
                    page={page}
                    pageSize={pageSize}
                />
            </CardContent>
        </Card>
    )
}
```

**Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/qc/qc-definitions-tab-content.tsx
git commit -m "refactor(qc): extract QCDefinitionsTabContent component"
```

---

## Task 4: Extract QCMaterialsTabContent

**Files:**
- Create: `src/components/qc/qc-materials-tab-content.tsx`

**Step 1: Create the materials tab content component**

Create `src/components/qc/qc-materials-tab-content.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QCMaterialsList, type QCMaterial } from './qc-materials-list'
import { LotChangeoverDialog } from './lot-changeover-dialog'
import { QCMaterialDialog } from './qc-material-dialog'
import type { QCDefinitionWithDetails } from './qc-definitions-table'

interface QCMaterialsTabContentProps {
    materials: QCMaterial[]
    definitions: QCDefinitionWithDetails[]
    // Pagination props
    total: number
    page: number
    pageSize: number
    search: string
    level: 'low' | 'normal' | 'high' | null
    status: 'valid' | 'expiring_soon' | 'expired' | null
}

export function QCMaterialsTabContent({
    materials,
    definitions,
    total,
    page,
    pageSize,
    search,
    level,
    status,
}: QCMaterialsTabContentProps) {
    const [showAddMaterial, setShowAddMaterial] = useState(false)

    // Get first material for LotChangeoverDialog (requires currentMaterial)
    const firstMaterial = materials[0] ? {
        id: materials[0].id,
        name: materials[0].name,
        manufacturer: materials[0].manufacturer || '',
        lot_number: materials[0].lot_number,
        level: materials[0].level,
        expiry_date: materials[0].expiry_date || '',
    } : null

    // Transform definitions for LotChangeoverDialog
    const definitionsForChangeover = definitions.map(d => ({
        id: d.id,
        mean: d.mean,
        sd: d.sd,
        cv_percent: d.cv_percent,
        assay: { id: d.assay_id, name: d.assay_name, units: d.assay_units },
    }))

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Vật liệu QC</CardTitle>
                            <CardDescription>
                                Quản lý vật liệu kiểm soát chất lượng
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => setShowAddMaterial(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Thêm vật liệu
                            </Button>
                            {firstMaterial && (
                                <LotChangeoverDialog
                                    currentMaterial={firstMaterial}
                                    definitions={definitionsForChangeover}
                                    trigger={
                                        <Button size="sm">
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Chuyển lô
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <QCMaterialsList
                        materials={materials}
                        total={total}
                        page={page}
                        pageSize={pageSize}
                        search={search}
                        level={level}
                        status={status}
                    />
                </CardContent>
            </Card>

            {/* Add Material Dialog */}
            <QCMaterialDialog
                open={showAddMaterial}
                onOpenChange={setShowAddMaterial}
                mode="create"
            />
        </>
    )
}
```

**Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/qc/qc-materials-tab-content.tsx
git commit -m "refactor(qc): extract QCMaterialsTabContent component"
```

---

## Task 5: Update Main Component to Use Extracted Components

**Files:**
- Modify: `src/components/qc/quality-control-page-client.tsx`

**Step 1: Update imports**

Replace imports section with:

```typescript
'use client'

import { useState } from 'react'
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Beaker,
    LineChart,
    ListChecks,
    Plus,
    RefreshCw,
    Settings,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QCStatsCards } from './qc-stats-cards'
import { QCOverviewTab, type ActiveSession, type PendingViolation } from './qc-overview-tab'
import { QCMaterialsTabContent } from './qc-materials-tab-content'
import { QCDefinitionsTabContent } from './qc-definitions-tab-content'
import { QCSessionsTabContent } from './qc-sessions-tab-content'
import { QCViolationsTabContent } from './qc-violations-tab-content'
import { QCAnalyticsTab, type QCDefinitionForAnalytics, type QCResultDataPoint } from './qc-analytics-tab'
import { ControlLimitsWizard } from './control-limits-wizard'
import { WalkthroughTrigger } from '@/components/walkthrough'
import type { QCMaterial } from './qc-materials-list'
import type { QCDefinitionWithDetails } from './qc-definitions-table'
import type { QCSessionRow } from '@/types/qc'
```

**Step 2: Remove unused imports and nested component**

Remove these imports (no longer needed in main file):
- `QCViolationsTab` (unused)
- `QCMaterialsList`
- `QCDefinitionsTable`
- `QCSessionsTable`
- `LotChangeoverDialog`
- `QCMaterialDialog`
- `ViolationResolutionDialog`

Remove the entire `QCViolationsTabWithDialogs` function at the end of the file (lines 403-463).

**Step 3: Remove moved state and computations**

Remove from component body:
```typescript
// Remove this line:
const [showAddMaterial, setShowAddMaterial] = useState(false)

// Remove these computations:
const firstMaterial = materials[0] ? { ... } : null
const definitionsForChangeover = definitions.map(...)
```

**Step 4: Update TabsContent sections**

Replace Materials tab (lines 259-301):
```typescript
<TabsContent value="materials">
    <QCMaterialsTabContent
        materials={materials}
        definitions={definitions}
        total={materialsTotal}
        page={materialsPage}
        pageSize={materialsPageSize}
        search={materialsSearch}
        level={materialsLevel}
        status={materialsStatus}
    />
</TabsContent>
```

Replace Definitions tab (lines 303-328):
```typescript
<TabsContent value="definitions">
    <QCDefinitionsTabContent
        definitions={definitions}
        total={definitionsTotal}
        page={definitionsPage}
        pageSize={definitionsPageSize}
        onEstablishLimits={() => setShowEstablishLimits(true)}
    />
</TabsContent>
```

Replace Sessions tab (lines 330-352):
```typescript
<TabsContent value="sessions">
    <QCSessionsTabContent
        specialties={specialties}
        assays={assays}
        sessionsData={sessionsData}
        sessionsTotal={sessionsTotal}
        sessionsTotalPages={sessionsTotalPages}
        sessionsPage={sessionsPage}
        sessionsPageSize={sessionsPageSize}
    />
</TabsContent>
```

Replace Violations tab (lines 354-366):
```typescript
<TabsContent value="violations">
    <QCViolationsTabContent violations={pendingViolations} />
</TabsContent>
```

**Step 5: Remove QCMaterialDialog from end of component**

Remove these lines (dialog moved to QCMaterialsTabContent):
```typescript
{/* Add Material Dialog */}
<QCMaterialDialog
    open={showAddMaterial}
    onOpenChange={setShowAddMaterial}
    mode="create"
/>
```

**Step 6: Verify types compile**

Run: `npm run typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/qc/quality-control-page-client.tsx
git commit -m "refactor(qc): use extracted tab content components"
```

---

## Task 6: Verify and Final Cleanup

**Step 1: Run full type check**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Run dev server and manually test**

Run: `npm run dev`

Test each tab:
1. Overview - verify sessions and violations display
2. Materials - verify list, pagination, "Thêm vật liệu" dialog, "Chuyển lô" dialog
3. Definitions - verify table, pagination, "Thiết lập mới" opens dialog
4. Sessions - verify table, filters, pagination
5. Violations - verify list, "Xử lý vi phạm" dialog works
6. Analytics - verify charts display

**Step 3: Count lines in refactored file**

Run: `wc -l src/components/qc/quality-control-page-client.tsx`
Expected: ~200-220 lines (under 350 limit)

**Step 4: Final commit**

```bash
git add -A
git commit -m "refactor(qc): complete tab extraction, main file now ~220 lines"
```

---

## Summary

| File | Lines | Status |
|------|-------|--------|
| `quality-control-page-client.tsx` | ~220 | Main orchestrator |
| `qc-violations-tab-content.tsx` | ~75 | New |
| `qc-sessions-tab-content.tsx` | ~55 | New |
| `qc-definitions-tab-content.tsx` | ~45 | New |
| `qc-materials-tab-content.tsx` | ~90 | New |

**Total extraction:** ~265 lines moved to 4 new files
**Result:** Main file reduced from 464 → ~220 lines (53% reduction)
