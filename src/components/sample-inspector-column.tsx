'use client'

import { motion, AnimatePresence } from 'motion/react'
import { SampleWithUser, type LabSpecialty, type ResultWithAssay } from '@/types'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { DoctorSampleMetadataPanel } from '@/components/doctor-sample-metadata-panel'
import { DoctorCoAPanel } from '@/components/doctor-coa-panel'
import { StickyPanelShell } from '@/components/ui/sticky-panel-shell'
import { durations, fadeInScale } from '@/lib/motion'
import { AlertCircle } from 'lucide-react'

const EMPTY_SPECIALTIES: LabSpecialty[] = []

interface SampleInspectorColumnProps {
    sample: SampleWithUser | null
    results?: ResultWithAssay[]
    isLoadingSample?: boolean
    loadErrorMessage?: string | null
    permissions?: {
        canDiscard: boolean
        canEdit: boolean
        canViewResults: boolean
        canEnterResults: boolean
    }
    specialties?: LabSpecialty[]
    userRole?: 'analyst' | 'manager' | 'doctor'
}

export function SampleInspectorColumn({
    sample,
    results,
    isLoadingSample = false,
    loadErrorMessage = null,
    specialties = EMPTY_SPECIALTIES,
    userRole,
}: SampleInspectorColumnProps) {
    const displayedSample = sample
    const displayedResults = results
    const isDoctor = userRole === 'doctor'

    if (loadErrorMessage && !displayedSample) {
        return (
            <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50/50 p-8">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold text-red-700">
                        Không thể tải chi tiết mẫu
                    </h3>
                    <p className="text-sm text-red-600">{loadErrorMessage}</p>
                </div>
            </div>
        )
    }

    if (isLoadingSample && !displayedSample) {
        return (
            <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-6">
                    <div className="text-sm text-slate-500">Đang tải chi tiết mẫu...</div>
                </div>
                <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-6">
                    <div className="text-sm text-slate-500">{isDoctor ? 'Đang tải CoA...' : 'Đang tải...'}</div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            {loadErrorMessage && displayedSample && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {loadErrorMessage}
                </div>
            )}

            <StickyPanelShell header="Thông tin mẫu" bodyClassName="min-h-0 p-0">
                <motion.div
                    className="flex h-full min-h-0 flex-col overflow-hidden"
                    initial={fadeInScale.initial}
                    animate={fadeInScale.animate}
                    transition={{ duration: durations.normal }}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={displayedSample?.id ?? 'empty'}
                            className="flex-1 min-h-0"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: durations.fast }}
                        >
                            {isDoctor ? (
                                <DoctorSampleMetadataPanel sample={displayedSample} />
                            ) : (
                                <SampleDetailPanel sample={displayedSample} />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </StickyPanelShell>

            <StickyPanelShell
                header={isDoctor ? 'CoA và kết quả' : 'Xét nghiệm và kết quả'}
                bodyClassName="min-h-0 p-0"
            >
                <motion.div
                    className="flex h-full min-h-0 flex-col overflow-hidden"
                    initial={fadeInScale.initial}
                    animate={fadeInScale.animate}
                    transition={{ duration: durations.normal, delay: 0.05 }}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={displayedSample?.id ?? 'empty-tests'}
                            className="flex-1 min-h-0"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: durations.fast }}
                        >
                            {displayedSample && isDoctor ? (
                                <DoctorCoAPanel
                                    sampleId={displayedSample.id}
                                    sampleDisplayId={displayedSample.sample_id}
                                />
                            ) : displayedSample ? (
                                <AssignedTestsPanel
                                    sampleId={displayedSample.id}
                                    specialties={specialties}
                                    userRole={userRole === 'doctor' ? undefined : userRole}
                                    initialResults={displayedResults}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-400">
                                    {isDoctor
                                        ? 'Chọn một mẫu đã hoàn thành để xem CoA'
                                        : 'Chọn một mẫu để xem chi tiết và chỉ định xét nghiệm'}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </StickyPanelShell>

            {isLoadingSample && displayedSample && (
                <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-white/60 px-4 py-8">
                    <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                        Đang chuyển sang mẫu tiếp theo...
                    </div>
                </div>
            )}
        </div>
    )
}
