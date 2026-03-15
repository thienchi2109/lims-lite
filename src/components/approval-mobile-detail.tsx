'use client'

/**
 * ApprovalMobileDetail
 *
 * Bottom drawer for viewing sample details and approving/rejecting on mobile.
 * Reuses existing SampleDetailPanel, AssignedTestsPanel, and ApprovalActions.
 * Opens when a sample is selected from the mobile card list.
 */

import { X } from 'lucide-react'
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerOverlay,
    DrawerPortal,
    DrawerTitle,
} from '@/components/ui/drawer'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { ApprovalActions } from '@/components/approval-actions'
import type { SampleWithUser, ResultWithAssay } from '@/types'

interface ApprovalMobileDetailProps {
    sample: SampleWithUser | null
    results: ResultWithAssay[]
    open: boolean
    onClose: () => void
}

export function ApprovalMobileDetail({
    sample,
    results,
    open,
    onClose,
}: ApprovalMobileDetailProps) {
    // Don't render drawer at all if no sample
    if (!sample) return null

    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DrawerPortal>
                <DrawerOverlay />
                <DrawerContent className="max-h-[90vh] flex flex-col">
                    {/* Drawer Header */}
                    <DrawerHeader className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                        <DrawerTitle className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {sample.sample_id}
                        </DrawerTitle>
                        <DrawerClose className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <X className="h-4 w-4 text-slate-500" />
                            <span className="sr-only">Đóng</span>
                        </DrawerClose>
                    </DrawerHeader>

                    {/* Scrollable content */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                        {/* Sample info */}
                        <SampleDetailPanel sample={sample} />

                        {/* Test results */}
                        <AssignedTestsPanel sampleId={sample.id} userRole="manager" />
                    </div>

                    {/* Sticky footer with approval actions */}
                    <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-white dark:bg-slate-950">
                        <ApprovalActions sampleId={sample.id} results={results} />
                    </div>
                </DrawerContent>
            </DrawerPortal>
        </Drawer>
    )
}
