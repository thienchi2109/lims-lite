'use client'

import { motion, AnimatePresence } from 'motion/react'
import { SampleWithUser, type LabSpecialty } from '@/types'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { durations, fadeInScale } from '@/lib/motion'

const EMPTY_SPECIALTIES: LabSpecialty[] = []

interface SampleBottomRowProps {
    sample: SampleWithUser | null
    isLoadingSample?: boolean
    permissions?: {
        canDiscard: boolean
        canEdit: boolean
        canViewResults: boolean
        canEnterResults: boolean
    }
    specialties?: LabSpecialty[]
    userRole?: 'analyst' | 'manager'
}

export function SampleBottomRow({ sample, isLoadingSample = false, permissions, specialties = EMPTY_SPECIALTIES, userRole }: SampleBottomRowProps) {
    // Loading state
    if (isLoadingSample) {
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
        <div className="grid h-full min-h-0 grid-cols-1 gap-2 lg:grid-cols-2">
            {/* Left Panel - Sample Details */}
            <motion.div
                className="h-full min-h-0 overflow-hidden"
                initial={fadeInScale.initial}
                animate={fadeInScale.animate}
                transition={{ duration: durations.normal }}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={sample?.id ?? 'empty'}
                        className="h-full min-h-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: durations.fast }}
                    >
                        <SampleDetailPanel sample={sample} />
                    </motion.div>
                </AnimatePresence>
            </motion.div>

            {/* Right Panel - Assigned Tests (staggered by 50ms) */}
            <motion.div
                className="h-full min-h-0 overflow-hidden"
                initial={fadeInScale.initial}
                animate={fadeInScale.animate}
                transition={{ duration: durations.normal, delay: 0.05 }}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={sample?.id ?? 'empty-tests'}
                        className="h-full min-h-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: durations.fast }}
                    >
                        {sample ? (
                            <AssignedTestsPanel sampleId={sample.id} specialties={specialties} userRole={userRole} />
                        ) : (
                            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-400">
                                Chọn một mẫu để xem chi tiết và chỉ định xét nghiệm
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
