'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, X, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface BatchSaveToolbarProps {
    pendingCount: number
    onSave: () => void
    onDiscard: () => void
    isSaving: boolean
    isVisible: boolean
}

export function BatchSaveToolbar({
    pendingCount,
    onSave,
    onDiscard,
    isSaving,
    isVisible,
}: BatchSaveToolbarProps) {
    const [showSuccess, setShowSuccess] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    useEffect(() => {
        if (isVisible) {
            setIsAnimating(true)
        } else {
            const timeout = setTimeout(() => setIsAnimating(false), 300)
            return () => clearTimeout(timeout)
        }
    }, [isVisible])

    useEffect(() => {
        if (!isSaving && pendingCount === 0 && isVisible) {
            setShowSuccess(true)
            const timeout = setTimeout(() => setShowSuccess(false), 2000)
            return () => clearTimeout(timeout)
        }
    }, [isSaving, pendingCount, isVisible])

    if (!isAnimating && !isVisible) return null

    return (
        <div
            className={cn(
                'fixed bottom-0 left-0 right-0 z-50 transform transition-all duration-300 ease-out',
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
            )}
        >
            <div className="mx-auto max-w-7xl p-4">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white/80 px-6 py-4 shadow-2xl backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/80">
                    <div className="flex items-center gap-3">
                        {showSuccess ? (
                            <>
                                <CheckCircle className="h-5 w-5 animate-in zoom-in text-green-600" />
                                <span className="font-medium text-green-600">
                                    Changes saved successfully!
                                </span>
                            </>
                        ) : (
                            <>
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        'gap-1 px-3 py-1 text-sm font-semibold',
                                        pendingCount > 0 && 'animate-pulse'
                                    )}
                                >
                                    <span className="text-lg">{pendingCount}</span>
                                    <span>unsaved {pendingCount === 1 ? 'change' : 'changes'}</span>
                                </Badge>
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    Press <kbd className="rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800">Ctrl+S</kbd> to save
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDiscard}
                            disabled={isSaving || pendingCount === 0}
                            className="gap-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                        >
                            <X className="h-4 w-4" />
                            Discard
                        </Button>
                        <Button
                            onClick={onSave}
                            disabled={isSaving || pendingCount === 0}
                            className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                            size="sm"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Batch
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
