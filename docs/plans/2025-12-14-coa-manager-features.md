# CoA Manager Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Certificate of Analysis (CoA) management features for managers - status indicators, regeneration buttons, error display, and access log viewer.

**Architecture:** Extend existing manager sample detail page with CoA status indicators and action buttons. Create reusable CoA status badge component following SampleStatusBadge pattern. Add dedicated access log viewer using SampleActivityFeed pattern. All features integrate with existing coa.ts server actions.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zod, Shadcn UI, TanStack Table, Supabase

---

## Task 1: Add CoA Database Types

**Files:**
- Modify: `src/types/index.ts` (after line 657, before export statements)

**Step 1: Add CoA Report and Access Log Zod schemas**

Add after `CoADownloadRequestSchema` (around line 657):

```typescript
// ============================================================================
// COA MANAGEMENT SCHEMAS (Manager Features)
// ============================================================================

export const CoAReportStatusSchema = z.enum(['pending', 'ready', 'failed'])
export type CoAReportStatus = z.infer<typeof CoAReportStatusSchema>

export const CoAReportSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().uuid(),
    file_path: z.string(),
    file_hash: z.string(),
    version: z.number().int().default(1),
    status: CoAReportStatusSchema,
    superseded_by: z.string().uuid().nullable().optional(),
    error_message: z.string().nullable().optional(),
    signature_id: z.string().uuid().nullable().optional(),
    generated_at: z.string().datetime(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type CoAReport = z.infer<typeof CoAReportSchema>

export const CoAAccessLogSchema = z.object({
    id: z.string().uuid(),
    client_id: z.string().uuid(),
    sample_id: z.string().uuid(),
    coa_report_id: z.string().uuid().nullable().optional(),
    accessed_at: z.string().datetime(),
    ip_address: z.string().nullable().optional(),
    user_agent: z.string().nullable().optional(),
    success: z.boolean(),
    failure_reason: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type CoAAccessLog = z.infer<typeof CoAAccessLogSchema>

// CoA Access Log with client name (for display)
export const CoAAccessLogWithClientSchema = CoAAccessLogSchema.extend({
    client_name: z.string(),
    sample_id_display: z.string(),
})

export type CoAAccessLogWithClient = z.infer<typeof CoAAccessLogWithClientSchema>
```

**Step 2: Run typecheck to verify no errors**

Run: `npm run typecheck`
Expected: No errors, types compile successfully

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add CoA report and access log TypeScript types"
```

---

## Task 2: Create CoA Status Badge Component

**Files:**
- Create: `src/components/coa-status-badge.tsx`

**Step 1: Write the component following SampleStatusBadge pattern**

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { type CoAReportStatus } from '@/types'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

interface CoAStatusBadgeProps {
    status: CoAReportStatus | null | undefined
}

const statusConfig: Record<
    CoAReportStatus,
    {
        label: string
        icon: React.ComponentType<{ className?: string }>
        className: string
    }
> = {
    pending: {
        label: 'Đang tạo',
        icon: Clock,
        className:
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    },
    ready: {
        label: 'Sẵn sàng',
        icon: CheckCircle2,
        className:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    },
    failed: {
        label: 'Lỗi',
        icon: XCircle,
        className:
            'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    },
}

export function CoAStatusBadge({ status }: CoAStatusBadgeProps) {
    if (!status) {
        return (
            <Badge
                variant="outline"
                className="capitalize rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm bg-slate-50 text-slate-500 border-slate-200"
            >
                Chưa tạo
            </Badge>
        )
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
        <Badge
            variant="outline"
            className={`capitalize rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm flex items-center gap-1 ${config.className}`}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    )
}
```

**Step 2: Test component imports**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/coa-status-badge.tsx
git commit -m "feat: add CoA status badge component with Vietnamese labels"
```

---

## Task 3: Add CoA Data Fetching to Sample Detail Page

**Files:**
- Modify: `src/app/(dashboard)/manager/results/[sampleId]/page.tsx:62-79`

**Step 1: Add CoA report fetch query**

Replace lines 62-79 (after getting sample, before getting results) with:

```typescript
    // Get sample details
    const { data: sample } = await supabase
        .from('samples')
        .select('*')
        .eq('id', resolvedParams.sampleId)
        .single()

    if (!sample) {
        return (
            <div className="p-6 text-red-500">
                Error: Sample not found in database.
                <br />
                Requested ID: {resolvedParams.sampleId}
                <br />
                User ID: {user.id}
            </div>
        )
    }

    // Get CoA report for this sample (if exists)
    const { data: coaReport } = await supabase
        .from('coa_reports')
        .select('id, status, error_message, file_path, generated_at')
        .eq('sample_id', resolvedParams.sampleId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/(dashboard)/manager/results/[sampleId]/page.tsx
git commit -m "feat: fetch CoA report data in manager sample detail page"
```

---

## Task 4: Add CoA Status Indicator to Sample Detail Page Header

**Files:**
- Modify: `src/app/(dashboard)/manager/results/[sampleId]/page.tsx:1-11` (imports)
- Modify: `src/app/(dashboard)/manager/results/[sampleId]/page.tsx:107-110` (header)

**Step 1: Add CoAStatusBadge import**

Add to imports (line 11):

```typescript
import { CoAStatusBadge } from '@/components/coa-status-badge'
```

**Step 2: Add CoA status badge next to sample status**

Replace lines 107-110 with:

```typescript
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">Xem xét kết quả</h1>
                        <div className="flex items-center gap-2">
                            <SampleStatusBadge status={sample.status} />
                            {sample.status === 'completed' && (
                                <CoAStatusBadge status={coaReport?.status} />
                            )}
                        </div>
                    </div>
```

**Step 3: Test the page loads without errors**

Run: `npm run dev`
Navigate to: `http://localhost:3000/manager/results/{any-sample-id}`
Expected: Page loads, CoA badge shows "Chưa tạo" if no report exists

**Step 4: Commit**

```bash
git add src/app/(dashboard)/manager/results/[sampleId]/page.tsx
git commit -m "feat: display CoA status badge in sample detail header"
```

---

## Task 5: Create CoA Actions Component with Regeneration Button

**Files:**
- Create: `src/components/coa-actions.tsx`

**Step 1: Write the CoA actions component**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, RefreshCcw, Download, AlertCircle } from 'lucide-react'
import { regenerateCoA } from '@/app/actions/coa'
import { useRouter } from 'next/navigation'
import { CoAStatusBadge } from '@/components/coa-status-badge'
import type { CoAReportStatus } from '@/types'

interface CoAActionsProps {
    sampleId: string
    sampleStatus: string
    coaReport?: {
        id: string
        status: CoAReportStatus
        error_message: string | null
        file_path: string
        generated_at: string
    } | null
}

export function CoAActions({ sampleId, sampleStatus, coaReport }: CoAActionsProps) {
    const [isRegenerating, setIsRegenerating] = useState(false)
    const router = useRouter()

    // Only show for completed samples
    if (sampleStatus !== 'completed') {
        return null
    }

    const handleRegenerate = async () => {
        setIsRegenerating(true)
        try {
            const result = await regenerateCoA(sampleId)
            if (result.success) {
                router.refresh()
            } else {
                alert(`Lỗi khi tạo lại CoA: ${result.error}`)
            }
        } catch (error) {
            alert(`Lỗi không mong đợi: ${error}`)
        } finally {
            setIsRegenerating(false)
        }
    }

    const handleDownload = () => {
        // Internal staff download (direct Storage access)
        // TODO: Implement direct download via signed URL
        alert('Chức năng tải xuống đang được phát triển')
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Giấy chứng nhận phân tích (CoA)
                        </CardTitle>
                        <CardDescription>
                            Quản lý và tải xuống giấy chứng nhận phân tích
                        </CardDescription>
                    </div>
                    {coaReport && <CoAStatusBadge status={coaReport.status} />}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Error Alert */}
                {coaReport?.status === 'failed' && coaReport.error_message && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Lỗi tạo CoA:</strong> {coaReport.error_message}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Status Info */}
                <div className="text-sm text-muted-foreground">
                    {!coaReport && (
                        <p>CoA chưa được tạo. Nhấn nút bên dưới để tạo mới.</p>
                    )}
                    {coaReport?.status === 'pending' && (
                        <p>CoA đang được tạo. Vui lòng đợi...</p>
                    )}
                    {coaReport?.status === 'ready' && (
                        <p>
                            CoA đã sẵn sàng. Tạo lúc:{' '}
                            {new Date(coaReport.generated_at).toLocaleString('vi-VN')}
                        </p>
                    )}
                    {coaReport?.status === 'failed' && (
                        <p>Tạo CoA thất bại. Vui lòng thử lại.</p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                    {/* Regenerate Button - Show for failed or to create new */}
                    {(!coaReport || coaReport.status === 'failed') && (
                        <Button
                            onClick={handleRegenerate}
                            disabled={isRegenerating}
                            className="gap-2"
                            size="lg"
                        >
                            <RefreshCcw className={`h-5 w-5 ${isRegenerating ? 'animate-spin' : ''}`} />
                            {!coaReport ? 'Tạo CoA' : 'Tạo lại CoA'}
                        </Button>
                    )}

                    {/* Download Button - Show when ready */}
                    {coaReport?.status === 'ready' && (
                        <Button
                            onClick={handleDownload}
                            variant="outline"
                            className="gap-2"
                            size="lg"
                        >
                            <Download className="h-5 w-5" />
                            Tải xuống CoA
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/coa-actions.tsx
git commit -m "feat: add CoA actions component with regeneration and download buttons"
```

---

## Task 6: Integrate CoA Actions into Sample Detail Page

**Files:**
- Modify: `src/app/(dashboard)/manager/results/[sampleId]/page.tsx:6` (imports)
- Modify: `src/app/(dashboard)/manager/results/[sampleId]/page.tsx:157-158` (add CoAActions)

**Step 1: Add CoAActions import**

Add to imports (after ApprovalActions):

```typescript
import { CoAActions } from '@/components/coa-actions'
```

**Step 2: Add CoAActions component after ApprovalActions**

Insert after line 157 (after `<ApprovalActions ... />`):

```typescript
            {/* CoA Actions */}
            <CoAActions
                sampleId={resolvedParams.sampleId}
                sampleStatus={sample.status}
                coaReport={coaReport || null}
            />
```

**Step 3: Test the integration**

Run: `npm run dev`
Navigate to: Manager results page with completed sample
Expected: CoA Actions card appears below Approval Actions
Expected: "Tạo CoA" button shows if no CoA exists
Expected: Error alert and "Tạo lại CoA" button show if CoA failed

**Step 4: Commit**

```bash
git add src/app/(dashboard)/manager/results/[sampleId]/page.tsx
git commit -m "feat: integrate CoA actions into manager sample detail page"
```

---

## Task 7: Create CoA Access Log Fetcher Server Action

**Files:**
- Modify: `src/app/actions/coa.ts` (end of file, before final export if any)

**Step 1: Add getCoAAccessLogs server action**

Add at the end of the file:

```typescript
// ============================================================================
// COA ACCESS LOG VIEWER (Manager Feature)
// ============================================================================

/**
 * Fetch CoA access logs for a sample (manager only)
 */
export async function getCoAAccessLogs(sampleId: string): Promise<{
    data: {
        id: string
        client_name: string
        sample_id_display: string
        accessed_at: string
        ip_address: string | null
        user_agent: string | null
        success: boolean
        failure_reason: string | null
    }[]
    error?: string
}> {
    try {
        const supabase = await createClient()

        // Verify user is manager
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { data: [], error: 'User not authenticated' }
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!userData || userData.role !== 'manager') {
            return { data: [], error: 'Unauthorized: Only managers can view access logs' }
        }

        // Fetch access logs with client name
        const { data: logs, error } = await supabase
            .from('coa_access_log')
            .select(
                `
                id,
                accessed_at,
                ip_address,
                user_agent,
                success,
                failure_reason,
                clients!inner (
                    name
                ),
                samples!inner (
                    sample_id
                )
            `
            )
            .eq('sample_id', sampleId)
            .order('accessed_at', { ascending: false })

        if (error) {
            console.error('Error fetching CoA access logs:', error)
            return { data: [], error: error.message }
        }

        // Transform data to flat structure
        const transformedLogs = (logs || []).map((log: any) => ({
            id: log.id,
            client_name: log.clients?.name || 'N/A',
            sample_id_display: log.samples?.sample_id || 'N/A',
            accessed_at: log.accessed_at,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            success: log.success,
            failure_reason: log.failure_reason,
        }))

        return { data: transformedLogs }
    } catch (error) {
        console.error('Unexpected error in getCoAAccessLogs:', error)
        return { data: [], error: 'Unexpected error occurred' }
    }
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/actions/coa.ts
git commit -m "feat: add getCoAAccessLogs server action for manager audit trail"
```

---

## Task 8: Create CoA Access Log Viewer Component

**Files:**
- Create: `src/components/coa-access-log-viewer.tsx`

**Step 1: Write the access log viewer component**

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { getCoAAccessLogs } from '@/app/actions/coa'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, Monitor } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface CoAAccessLogViewerProps {
    sampleId: string
}

export function CoAAccessLogViewer({ sampleId }: CoAAccessLogViewerProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['coa-access-logs', sampleId],
        queryFn: async () => {
            const result = await getCoAAccessLogs(sampleId)
            if (result.error) throw new Error(result.error)
            return result.data
        },
        refetchInterval: 30000, // Auto-refresh every 30 seconds
    })

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Lịch sử truy cập CoA</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-red-500">
                        Lỗi: {error instanceof Error ? error.message : 'Unknown error'}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Lịch sử truy cập CoA
                </CardTitle>
                <CardDescription>
                    Nhật ký các lần khách hàng truy cập và tải xuống giấy chứng nhận
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 animate-spin" />
                        Đang tải...
                    </div>
                ) : !data || data.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        Chưa có lịch sử truy cập nào.
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Thời gian</TableHead>
                                    <TableHead>Khách hàng</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Lý do lỗi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-mono text-xs">
                                            {new Date(log.accessed_at).toLocaleString('vi-VN')}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {log.client_name}
                                        </TableCell>
                                        <TableCell>
                                            {log.success ? (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                                                >
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Thành công
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 bg-red-50 text-red-700 border-red-200"
                                                >
                                                    <XCircle className="h-3 w-3" />
                                                    Thất bại
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {log.ip_address || 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {log.failure_reason || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/coa-access-log-viewer.tsx
git commit -m "feat: add CoA access log viewer component with auto-refresh"
```

---

## Task 9: Integrate CoA Access Log Viewer into Sample Detail Page

**Files:**
- Modify: `src/app/(dashboard)/manager/results/[sampleId]/page.tsx:6` (imports)
- Modify: `src/app/(dashboard)/manager/results/[sampleId]/page.tsx` (before Activity Feed)

**Step 1: Add CoAAccessLogViewer import**

Add to imports:

```typescript
import { CoAAccessLogViewer } from '@/components/coa-access-log-viewer'
```

**Step 2: Add CoA Access Log Viewer before Activity Feed**

Insert before the Activity Feed Collapsible (before line 160):

```typescript
            {/* CoA Access Log Viewer - Only show for completed samples with CoA */}
            {sample.status === 'completed' && coaReport?.status === 'ready' && (
                <CoAAccessLogViewer sampleId={resolvedParams.sampleId} />
            )}
```

**Step 3: Test the integration**

Run: `npm run dev`
Navigate to: Manager results page with completed sample that has CoA
Expected: CoA Access Log Viewer appears before Activity Feed
Expected: Shows "Chưa có lịch sử truy cập nào" if no logs exist
Expected: Auto-refreshes every 30 seconds

**Step 4: Commit**

```bash
git add src/app/(dashboard)/manager/results/[sampleId]/page.tsx
git commit -m "feat: add CoA access log viewer to manager sample detail page"
```

---

## Task 10: Add CoA Status Column to Approval Queue Table

**Files:**
- Modify: `src/components/approval-queue-table.tsx`

**Step 1: Read the current ApprovalQueueTable component**

Run: `cat src/components/approval-queue-table.tsx | head -n 50`
Expected: See the component structure and column definitions

**Step 2: Add CoA status to table data fetch**

Find the data fetching query (likely around line 30-50) and add `coa_reports` to the select:

```typescript
// Find this pattern in the component:
.select(`
    id,
    sample_id,
    status,
    client_name,
    received_at,
    // ... other fields
`)

// Add this:
.select(`
    id,
    sample_id,
    status,
    client_name,
    received_at,
    coa_reports!left (
        status
    )
    // ... other fields
`)
```

**Step 3: Add CoA Status column definition**

Find the column definitions (ColumnDef array) and add after the sample status column:

```typescript
{
    accessorKey: 'coa_status',
    header: 'CoA',
    cell: ({ row }) => {
        const coaStatus = row.original.coa_reports?.[0]?.status
        return <CoAStatusBadge status={coaStatus} />
    },
},
```

**Step 4: Add CoAStatusBadge import**

Add to the imports section:

```typescript
import { CoAStatusBadge } from '@/components/coa-status-badge'
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 6: Test the table**

Run: `npm run dev`
Navigate to: Manager approvals page
Expected: CoA status column appears in approval queue table
Expected: Shows badge for each sample's CoA status

**Step 7: Commit**

```bash
git add src/components/approval-queue-table.tsx
git commit -m "feat: add CoA status column to approval queue table"
```

---

## Task 11: Final Testing and Validation

**Files:**
- None (testing only)

**Step 1: Test full CoA workflow as manager**

1. Navigate to completed sample without CoA
2. Verify "Chưa tạo" badge shows
3. Click "Tạo CoA" button
4. Verify badge changes to "Đang tạo"
5. Refresh page after generation
6. Verify badge shows "Sẵn sàng"
7. Verify "Tải xuống CoA" button appears

**Step 2: Test failed CoA scenario**

1. Manually set a CoA record to failed status in database:
   ```sql
   UPDATE coa_reports
   SET status = 'failed', error_message = 'Test error'
   WHERE sample_id = 'test-sample-id';
   ```
2. Navigate to sample detail page
3. Verify error alert appears with error message
4. Verify "Tạo lại CoA" button appears
5. Click button and verify regeneration works

**Step 3: Test access log viewer**

1. Navigate to sample with CoA access history
2. Verify access log table appears
3. Verify correct client names, timestamps, and statuses
4. Wait 30 seconds and verify auto-refresh

**Step 4: Test approval queue table CoA column**

1. Navigate to manager approvals page
2. Verify CoA status column appears
3. Verify badges show correct statuses for all samples

**Step 5: Run full typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: No errors, clean build

**Step 6: Create final commit**

```bash
git add -A
git commit -m "test: verify Phase 7 CoA manager features complete"
```

---

## Task 12: Update Tasks Documentation

**Files:**
- Modify: `openspec/changes/add-coa-generation-and-access/tasks.md:47-52`

**Step 1: Mark Phase 7 tasks as complete**

Update lines 47-52:

```markdown
## 7. Frontend - Manager Features
- [x] 7.1 Add CoA status indicator to sample detail panel
- [x] 7.2 Create "Tạo lại CoA" (Regenerate CoA) button for failed generations
- [x] 7.3 Display CoA generation errors to managers with retry option
- [x] 7.4 Add CoA access log viewer for managers (audit trail)
```

**Step 2: Commit documentation update**

```bash
git add openspec/changes/add-coa-generation-and-access/tasks.md
git commit -m "docs: mark Phase 7 CoA manager features as complete"
```

---

## Success Criteria

**Phase 7 is complete when:**

1. ✅ CoA status badge shows on sample detail page header
2. ✅ CoA status badge shows on approval queue table
3. ✅ CoA Actions card appears on completed samples
4. ✅ "Tạo CoA" button works for samples without CoA
5. ✅ "Tạo lại CoA" button appears for failed CoA generation
6. ✅ Error alert displays CoA generation errors to managers
7. ✅ CoA Access Log Viewer shows client download history
8. ✅ Access log auto-refreshes every 30 seconds
9. ✅ All TypeScript types are properly defined
10. ✅ All components follow existing patterns (Badge, Card, Table)
11. ✅ All UI text is in Vietnamese
12. ✅ npm run typecheck passes with no errors

---

## Notes for Implementation

**Component Patterns to Follow:**
- Badge components: Follow `SampleStatusBadge` pattern
- Action cards: Follow `ApprovalActions` pattern
- Data tables: Use `@tanstack/react-table` with auto-refresh
- Server actions: Return `{ data, error }` pattern

**Vietnamese Translations:**
- "Certificate of Analysis" → "Giấy chứng nhận phân tích"
- "Pending" → "Đang tạo"
- "Ready" → "Sẵn sàng"
- "Failed" → "Lỗi"
- "Access Log" → "Lịch sử truy cập"
- "Regenerate" → "Tạo lại"

**Security Considerations:**
- Access log viewer requires manager role (enforced in server action)
- CoA regeneration restricted to managers via RLS policies
- All CoA operations logged to audit_logs table

**Performance:**
- Access log viewer uses 30-second auto-refresh
- Pagination not needed for access logs (typically <100 records per sample)
- CoA status fetched with sample data (single query)

---

## Execution Options

Plan complete and saved to `docs/plans/2025-12-14-coa-manager-features.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach would you prefer?
