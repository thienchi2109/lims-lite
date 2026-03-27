'use client'

import { motion, AnimatePresence } from 'motion/react'
import { SampleWithUser, type LabSpecialty, type ResultWithAssay } from '@/types'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { durations, fadeInScale } from '@/lib/motion'
import { AlertCircle } from 'lucide-react'

const EMPTY_SPECIALTIES: LabSpecialty[] = []
const EMPTY_RESULTS: ResultWithAssay[] = []

interface SampleBottomRowProps {
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
    userRole?: 'analyst' | 'manager'
}

export function SampleBottomRow({
    sample,
    results = EMPTY_RESULTS,
    isLoadingSample = false,
    loadErrorMessage = null,
    permissions,
    specialties = EMPTY_SPECIALTIES,
    userRole,
}: SampleBottomRowProps) {
    const displayedSample = sample
    const displayedResults = results

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
            <div className="grid h-full min-h-0 grid-cols-1 gap-2 lg:grid-cols-2">
                <div className="h-full min-h-0 flex items-center justify-center rounded-lg border border-slate-200 bg-white p-6">
                    <div className="text-sm text-slate-500">Đang tải chi tiết mẫu...</div>
                </div>
                <div className="h-full min-h-0 flex items-center justify-center rounded-lg border border-slate-200 bg-white p-6">
                    <div className="text-sm text-slate-500">Đang tải...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative flex h-full min-h-0 flex-col gap-2">
            {loadErrorMessage && displayedSample && (
                <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {loadErrorMessage}
                </div>
            )}

            <div className="grid h-full min-h-0 grid-cols-1 gap-2 lg:grid-cols-2">
                {/* Left Panel - Sample Details */}
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
                            <SampleDetailPanel sample={displayedSample} />
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                {/* Right Panel - Assigned Tests (staggered by 50ms) */}
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
                            {displayedSample ? (
                                <AssignedTestsPanel
                                    sampleId={displayedSample.id}
                                    specialties={specialties}
                                    userRole={userRole}
                                    initialResults={displayedResults}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-400">
                                    Chọn một mẫu để xem chi tiết và chỉ định xét nghiệm
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>

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
