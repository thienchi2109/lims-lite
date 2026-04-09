import { useEffect, useRef, useState } from 'react'

interface UseGridHighlightOptions {
  /** Time in ms before highlight fades (default: 2000) */
  highlightDuration?: number
  /** Skip initial mount animation (default: true) */
  skipInitialAnimation?: boolean
}

interface RowWithTimestamp {
  id: string
  updated_at: string | null
}

/**
 * Hook to track row updates and return highlighted row IDs for animation.
 * Compares updated_at timestamps to detect changes.
 *
 * Unlike the original useUpdatedRows, this hook properly uses useEffect
 * to avoid side effects during render.
 */
export function useGridHighlight<T extends RowWithTimestamp>(
  rows: T[],
  options: UseGridHighlightOptions = {}
): Set<string> {
  const { highlightDuration = 2000, skipInitialAnimation = true } = options

  const prevTimestampsRef = useRef<Map<string, string | null>>(new Map())
  const isInitialMountRef = useRef(skipInitialAnimation)
  const timeoutIdsRef = useRef<Set<NodeJS.Timeout>>(new Set())
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())

  // Cleanup all timeouts on unmount
  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current
    return () => {
      timeoutIds.forEach(id => clearTimeout(id))
      timeoutIds.clear()
    }
  }, [])

  useEffect(() => {
    // Skip animation on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      // Store initial timestamps
      const initialMap = new Map<string, string | null>()
      rows.forEach(row => initialMap.set(row.id, row.updated_at))
      prevTimestampsRef.current = initialMap
      return
    }

    // Find changed rows by comparing timestamps
    const changedIds: string[] = []
    const shouldHighlightInitialRows = !skipInitialAnimation && prevTimestampsRef.current.size === 0
    rows.forEach(row => {
      const prevTimestamp = prevTimestampsRef.current.get(row.id)
      // Use undefined check (not truthy) so null→value transitions are detected
      if (
        (shouldHighlightInitialRows && row.updated_at !== null) ||
        (prevTimestamp !== undefined && prevTimestamp !== row.updated_at)
      ) {
        changedIds.push(row.id)
      }
    })

    // Update timestamps (for new rows and changed rows)
    const newMap = new Map<string, string | null>()
    rows.forEach(row => newMap.set(row.id, row.updated_at))
    prevTimestampsRef.current = newMap

    if (changedIds.length > 0) {
      let isCancelled = false

      queueMicrotask(() => {
        if (isCancelled) return

        // Add changed IDs to highlighted set
        setHighlightedIds(prev => {
          const next = new Set(prev)
          changedIds.forEach(id => next.add(id))
          return next
        })

        // Auto-clear highlights after duration
        const timeoutId = setTimeout(() => {
          setHighlightedIds(prev => {
            const next = new Set(prev)
            changedIds.forEach(id => next.delete(id))
            return next
          })
          timeoutIdsRef.current.delete(timeoutId)
        }, highlightDuration)

        // Track timeout for cleanup
        timeoutIdsRef.current.add(timeoutId)
      })

      return () => {
        isCancelled = true
      }
    }
  }, [rows, highlightDuration, skipInitialAnimation])

  return highlightedIds
}
