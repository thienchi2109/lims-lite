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
    return () => {
      timeoutIdsRef.current.forEach(id => clearTimeout(id))
      timeoutIdsRef.current.clear()
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
    rows.forEach(row => {
      const prevTimestamp = prevTimestampsRef.current.get(row.id)
      if (prevTimestamp && prevTimestamp !== row.updated_at) {
        changedIds.push(row.id)
      }
    })

    if (changedIds.length > 0) {
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
    }

    // Update timestamps (for new rows and changed rows)
    const newMap = new Map<string, string | null>()
    rows.forEach(row => newMap.set(row.id, row.updated_at))
    prevTimestampsRef.current = newMap
  }, [rows, highlightDuration])

  return highlightedIds
}
