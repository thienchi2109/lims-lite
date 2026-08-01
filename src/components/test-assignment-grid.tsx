'use client'

import React, { useState } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useTestAssignmentGrid } from '@/hooks/use-test-assignment-grid'
import type { TestAssignmentGridProps } from '@/types/test-assignment'
import { CheckCircle2 } from 'lucide-react'
import { FlaskConical } from 'lucide-react'
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@/components/ui/resizable"
import { MobileView } from './test-assignment/mobile-view'
import { DesktopGrid } from './test-assignment/desktop-grid'
import { SelectionPanel } from './test-assignment/selection-panel'

const EMPTY_DISABLED_IDS: string[] = []
const EMPTY_SPECIALTIES: import('@/types').LabSpecialty[] = []

export function TestAssignmentGrid({
    selected,
    onChange,
    context,
    disabledAssayIds = EMPTY_DISABLED_IDS,
    specialties = EMPTY_SPECIALTIES,
    onSave = () => { },
    isSaving = false,
    isSaveDisabled = false,
    saveLabel = 'Lưu thay đổi',
    summaryInfo,
    wizardProps,
}: TestAssignmentGridProps) {
    const isDesktop = useMediaQuery("(min-width: 1280px)")
    const [isContextOpen, setIsContextOpen] = useState(true)
    const [showToast, setShowToast] = useState(false)

    const logic = useTestAssignmentGrid({
        selected,
        onChange,
        disabledAssayIds,
        specialties
    })

    // --- MOBILE LAYOUT ---
    if (!isDesktop) {
        return (
            <MobileView
                context={context}
                isContextOpen={isContextOpen}
                setIsContextOpen={setIsContextOpen}
                searchQuery={logic.searchQuery}
                setSearchQuery={logic.setSearchQuery}
                selectedSpecialtyId={logic.selectedSpecialtyId}
                setSelectedSpecialtyId={logic.setSelectedSpecialtyId}
                specialties={specialties}
                groupedRows={logic.groupedRows}
                isLoading={logic.isLoading}
                disabledSet={logic.disabledSet}
                specialtiesMap={logic.specialtiesMap}
                selected={selected}
                onChange={onChange}
                toggleTestSelection={logic.toggleTestSelection}
                toggleGroupSelection={logic.toggleGroupSelection}
                handleMethodChange={logic.handleMethodChange}
                onSave={onSave}
                isSaving={isSaving}
                isSaveDisabled={isSaveDisabled}
                saveLabel={saveLabel}
                wizardProps={wizardProps}
            />
        )
    }

    // --- DESKTOP LAYOUT ---
    return (
        <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
            <ResizablePanelGroup
                direction="horizontal"
                className="h-full border rounded-lg shadow-sm bg-white dark:bg-slate-950"
            >
                {/* LEFT PANE: CONTEXT */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                    <aside className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col z-20">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 mb-1">
                                <FlaskConical size={18} />
                                <span className="font-bold tracking-tight text-sm">CDC<span className="text-slate-900 dark:text-slate-100"> LIMS</span> Pro</span>
                            </div>
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto">
                            {context}
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-[10px] text-slate-500 text-center">
                            Workflow: Test Assignment
                        </div>
                    </aside>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* CENTER PANE: ACCORDION CATALOG */}
                <ResizablePanel defaultSize={55}>
                    <DesktopGrid
                        searchQuery={logic.searchQuery}
                        setSearchQuery={logic.setSearchQuery}
                        selectedMethodId={logic.selectedMethodId}
                        setSelectedMethodId={logic.setSelectedMethodId}
                        selectedSpecialtyId={logic.selectedSpecialtyId}
                        setSelectedSpecialtyId={logic.setSelectedSpecialtyId}
                        methods={logic.methods}
                        specialties={specialties}
                        groupedRows={logic.groupedRows}
                        processedAssays={logic.processedAssays}
                        isLoading={logic.isLoading}
                        disabledSet={logic.disabledSet}
                        specialtiesMap={logic.specialtiesMap}
                        selected={selected}
                        toggleTestSelection={logic.toggleTestSelection}
                        toggleGroupSelection={logic.toggleGroupSelection}
                        handleMethodChange={logic.handleMethodChange}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* RIGHT PANE: STAGING AREA */}
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                    <SelectionPanel
                        selected={selected}
                        onChange={onChange}
                        handleRemove={logic.handleRemove}
                        handleMethodChange={logic.handleMethodChange}
                        availableAssays={logic.processedAssays}
                        onSave={onSave}
                        isSaving={isSaving}
                        isSaveDisabled={isSaveDisabled}
                        saveLabel={saveLabel}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>

            {/* Toast Notification */}
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded shadow-lg flex items-center gap-3 transition-all duration-300 z-50 ${showToast ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
                <CheckCircle2 size={18} className="text-green-400" />
                <span className="text-sm font-medium">Đã lưu thay đổi</span>
            </div>
        </div>
    )
}
