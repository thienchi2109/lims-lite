'use client'

import React, { useState } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useTestAssignmentGrid } from '@/hooks/use-test-assignment-grid'
import type { TestAssignmentGridProps } from '@/types/test-assignment'
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
    allowedAssayIds,
    specialties = EMPTY_SPECIALTIES,
    onSave = () => { },
    isSaving = false,
    isSaveDisabled = false,
    saveLabel = 'Lưu thay đổi',
    wizardProps,
}: TestAssignmentGridProps) {
    const isDesktop = useMediaQuery("(min-width: 1280px)")
    const [isContextOpen, setIsContextOpen] = useState(true)

    const logic = useTestAssignmentGrid({
        selected,
        onChange,
        disabledAssayIds,
        allowedAssayIds,
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

        </div>
    )
}
