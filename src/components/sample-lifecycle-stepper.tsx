'use client'

import { cn } from '@/lib/utils'
import { Check, Clock, FlaskConical, Inbox } from 'lucide-react'
import type { SampleStatus } from '@/types'

interface SampleLifecycleStepperProps {
    status: SampleStatus
    className?: string
}

const steps = [
    {
        id: 'received',
        label: 'Đã nhận',
        icon: Inbox,
        color: 'text-yellow-700 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
    },
    {
        id: 'assigned',
        label: 'Đã chỉ định',
        icon: FlaskConical,
        color: 'text-sky-700 dark:text-sky-400',
        bg: 'bg-sky-50 dark:bg-sky-900/20',
        border: 'border-sky-200 dark:border-sky-800',
    },
    {
        id: 'in_progress',
        label: 'Đang thực hiện',
        icon: Clock,
        color: 'text-indigo-700 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        border: 'border-indigo-200 dark:border-indigo-800',
    },
    {
        id: 'completed',
        label: 'Hoàn thành',
        icon: Check,
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        border: 'border-emerald-200 dark:border-emerald-800',
    },
] as const

const statusOrder = ['received', 'assigned', 'in_progress', 'review', 'completed']

export function SampleLifecycleStepper({ status, className }: SampleLifecycleStepperProps) {
    // Handle edge cases
    if (status === 'discarded') {
        return (
            <div className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", className)}>
                Đã loại bỏ
            </div>
        )
    }

    const currentStepIndex = statusOrder.indexOf(status === 'review' ? 'in_progress' : status)

    // If status is not found (e.g. review might map to in_progress visually if we don't have a specific step for it)
    // For now, let's treat 'review' as 'in_progress' + 1 conceptually or just map it to 'in_progress' step but visually distinct?
    // The plan said: "Note: review (Chờ duyệt) can be a sub-step or grouped here".
    // Let's stick to the 4 main steps and maybe highlight 'in_progress' for review as well, or better:
    // If review is not in the steps array, we need to decide where it lights up.
    // Let's assume 'review' means we passed 'in_progress' but not 'completed'.
    // Actually, 'review' is often between in_progress and completed.

    // Let's normalize the index for rendering
    let activeIndex = currentStepIndex
    if (status === 'review') {
        activeIndex = 2 // Still highlight "Đang thực hiện" or maybe we need a special indicator?
        // Or we can say it's step 3 but the label changes?
        // Let's just use simple mapping for now:
        // received -> 0
        // assigned -> 1
        // in_progress -> 2 (also covers review for now or we make review step 2.5)
        // completed -> 3
    }

    return (
        <nav aria-label="Progress" className={cn("flex items-center", className)}>
            <ol role="list" className="flex items-center w-full max-w-xs space-x-1">
                {steps.map((step, index) => {
                    const isCompleted = index < activeIndex
                    const isCurrent = index === activeIndex
                    const Icon = step.icon

                    return (
                        <li key={step.id} className="relative flex-1">
                            {index > 0 && (
                                <div
                                    className={cn(
                                        "absolute top-1/2 right-full h-0.5 w-full -mr-2 sm:-mr-4 -z-10",
                                        index <= activeIndex
                                            ? "bg-sky-500/30 dark:bg-sky-400/30"
                                            : "bg-slate-200 dark:bg-slate-800"
                                    )}
                                />
                            )}

                            <div className={cn(
                                "group flex flex-col items-center group relative",
                                isCurrent ? "opacity-100" : isCompleted ? "opacity-80 hover:opacity-100" : "opacity-40"
                            )}>
                                <span className={cn(
                                    "flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-300",
                                    isCurrent
                                        ? "border-sky-600 bg-white dark:border-sky-400 dark:bg-slate-950 scale-110 shadow-sm"
                                        : isCompleted
                                            ? "border-sky-600 bg-sky-50 dark:border-sky-500 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400"
                                            : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-slate-300"
                                )}>
                                    <Icon className={cn("w-3 h-3", isCurrent && "text-sky-600 dark:text-sky-400")} />
                                </span>

                                <span className={cn(
                                    "absolute top-7 text-[10px] font-medium whitespace-nowrap transition-colors duration-300",
                                    isCurrent
                                        ? "text-sky-700 dark:text-sky-400 font-bold"
                                        : isCompleted
                                            ? "text-slate-600 dark:text-slate-400"
                                            : "text-slate-400 dark:text-slate-600"
                                )}>
                                    {step.label}
                                </span>
                            </div>
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}

// Chevron style alternative (Premium "Pro Max" look)
export function SampleLifecycleChevron({ status, className }: SampleLifecycleStepperProps) {
    if (status === 'discarded') {
        return (
            <div className={cn("inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 uppercase tracking-wide", className)}>
                Đã loại bỏ
            </div>
        )
    }

    const stepMap: Record<string, number> = {
        'received': 0,
        'assigned': 1,
        'in_progress': 2,
        'review': 2, // Map review to in_progress step
        'completed': 3
    }

    const normalizedIndex = stepMap[status] ?? 0

    return (
        <div className={cn("flex items-center filter drop-shadow-sm", className)}>
            {steps.map((step, index) => {
                const isActive = index === normalizedIndex
                const isCompleted = index < normalizedIndex
                const isFirst = index === 0
                const isLast = index === steps.length - 1
                const Icon = step.icon

                // Dynamic background based on state
                let bgClass = "bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400" // Default future
                if (isActive) {
                    bgClass = "bg-sky-500 text-white dark:bg-sky-600 font-bold shadow-inner"
                } else if (isCompleted) {
                    bgClass = "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
                }

                // Hover effects
                const hoverClass = !isActive ? "hover:bg-slate-50 dark:hover:bg-slate-900" : ""

                return (
                    <div
                        key={step.id}
                        className={cn(
                            "relative flex items-center justify-center h-8 sm:h-9 pl-6 pr-2 sm:pl-8 sm:pr-4 text-[10px] sm:text-xs transition-colors duration-200 select-none",
                            bgClass,
                            hoverClass,
                            isFirst && "pl-3 sm:pl-4 rounded-l-md", // Less padding on first item left
                            isLast && "rounded-r-md pr-3 sm:pr-4"  // Less padding on last item right, clean edge
                        )}
                        style={{
                            clipPath: isLast
                                ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)' // Flat right, arrow cut left
                                : isFirst
                                    ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)' // Flat left, arrow point right
                                    : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)', // Arrow point right, arrow cut left
                            marginLeft: isFirst ? 0 : '-12px', // Overlap
                            zIndex: steps.length - index // Stack order (first on top? No, usually next covers previous? wait.)
                            // If I cut the left side of item 2, it needs to sit ON TOP of item 1's right point? 
                            // No, item 1 has a point. Item 2 has a cut. Item 1 needs to fit INTO Item 2's cut.
                            // So Item 1 is technically "behind" if they overlap rects?
                            // Actually with clip-path they don't occlude if they fit perfectly.
                            // But usually we just stack them.
                            // Let's try zIndex: index
                        }}
                    >
                        <div className="flex items-center gap-1.5 z-10">
                            <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "opacity-80")} />
                            <span className={cn("hidden sm:inline", isActive ? "inline" : "")}>
                                {step.label}
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
