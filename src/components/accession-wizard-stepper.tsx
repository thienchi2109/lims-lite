'use client'

/**
 * AccessionWizardStepper
 *
 * Horizontal 4-step progress indicator for mobile accession wizard.
 * Shows active, completed, and upcoming step states.
 */

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export const WIZARD_STEPS = [
    { label: 'Khách hàng', key: 'customer' },
    { label: 'Xét nghiệm', key: 'tests' },
    { label: 'Xem lại', key: 'review' },
    { label: 'Lưu', key: 'save' },
] as const

export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key']

interface AccessionWizardStepperProps {
    currentStep: number
}

export function AccessionWizardStepper({ currentStep }: AccessionWizardStepperProps) {
    return (
        <nav
            aria-label="Tiến trình tiếp nhận mẫu"
            className="flex items-center justify-between px-2 py-4"
        >
            {WIZARD_STEPS.map((step, index) => {
                const isCompleted = index < currentStep
                const isActive = index === currentStep
                const isUpcoming = index > currentStep

                return (
                    <div key={step.key} className="flex flex-1 items-center">
                        {/* Step circle + label */}
                        <div className="flex flex-col items-center gap-1.5">
                            <div
                                aria-current={isActive ? 'step' : undefined}
                                className={cn(
                                    'flex size-8 items-center justify-center rounded-full text-sm font-bold transition-colors duration-200',
                                    isCompleted && 'bg-primary text-primary-foreground shadow-sm',
                                    isActive && 'bg-primary text-primary-foreground shadow-lg shadow-primary/30',
                                    isUpcoming && 'border-2 border-muted-foreground/30 bg-background text-muted-foreground',
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="size-4" strokeWidth={3} />
                                ) : (
                                    index + 1
                                )}
                            </div>
                            <span
                                className={cn(
                                    'text-[10px] font-medium transition-colors duration-200',
                                    (isCompleted || isActive) && 'font-semibold text-primary',
                                    isUpcoming && 'text-muted-foreground',
                                )}
                            >
                                {step.label}
                            </span>
                        </div>

                        {/* Connector line */}
                        {index < WIZARD_STEPS.length - 1 && (
                            <div
                                className={cn(
                                    'mx-1 h-0.5 flex-1 rounded-full transition-colors duration-300',
                                    index < currentStep
                                        ? 'bg-primary'
                                        : 'bg-muted-foreground/20',
                                )}
                            />
                        )}
                    </div>
                )
            })}
        </nav>
    )
}
