'use client'

import { useEffect } from 'react'

interface UseUnsavedChangesGuardOptions {
    hasUnsavedChanges: boolean
    onSave: () => void
}

/**
 * Hook to handle unsaved changes protection:
 * - Ctrl+S / Cmd+S keyboard shortcut to save
 * - Browser beforeunload warning when leaving with unsaved changes
 */
export function useUnsavedChangesGuard({
    hasUnsavedChanges,
    onSave,
}: UseUnsavedChangesGuardOptions) {
    // Keyboard shortcut for save (Ctrl+S / Cmd+S)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                if (hasUnsavedChanges) {
                    onSave()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [hasUnsavedChanges, onSave])

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                e.returnValue = ''
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])
}
