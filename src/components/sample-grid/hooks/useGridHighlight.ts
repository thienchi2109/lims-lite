import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

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

function createTimestampMap<T extends RowWithTimestamp>(rows: T[]) {
  const nextMap = new Map<string, string | null>()
  rows.forEach(row => nextMap.set(row.id, row.updated_at))
  return nextMap
}

function findChangedRowIds<T extends RowWithTimestamp>(
  rows: T[],
  previousTimestamps: Map<string, string | null>,
  shouldHighlightInitialRows: boolean
) {
  const changedIds: string[] = []
  rows.forEach(row => {
    const prevTimestamp = previousTimestamps.get(row.id)
    if (
      (shouldHighlightInitialRows && row.updated_at !== null) ||
      (prevTimestamp !== undefined && prevTimestamp !== row.updated_at)
    ) {
      changedIds.push(row.id)
    }
  })
  return changedIds
}

function addHighlightedIds(previousIds: Set<string>, changedIds: string[]) {
  const next = new Set(previousIds)
  changedIds.forEach(id => next.add(id))
  return next
}

function removeHighlightedIds(previousIds: Set<string>, changedIds: string[]) {
  const next = new Set(previousIds)
  changedIds.forEach(id => next.delete(id))
  return next
}

function scheduleHighlightCleanup(
  changedIds: string[],
  highlightDuration: number,
  timeoutIdsRef: MutableRefObject<Set<NodeJS.Timeout>>,
  setHighlightedIds: Dispatch<SetStateAction<Set<string>>>
) {
  const timeoutId = setTimeout(() => {
    setHighlightedIds(prev => removeHighlightedIds(prev, changedIds))
    timeoutIdsRef.current.delete(timeoutId)
  }, highlightDuration)

  timeoutIdsRef.current.add(timeoutId)
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
      prevTimestampsRef.current = createTimestampMap(rows)
      return
    }

    // Find changed rows by comparing timestamps
    const shouldHighlightInitialRows = !skipInitialAnimation && prevTimestampsRef.current.size === 0
    const changedIds = findChangedRowIds(rows, prevTimestampsRef.current, shouldHighlightInitialRows)

    // Update timestamps (for new rows and changed rows)
    prevTimestampsRef.current = createTimestampMap(rows)

    if (changedIds.length > 0) {
      let isCancelled = false

      queueMicrotask(() => {
        if (isCancelled) return

        // Add changed IDs to highlighted set
        setHighlightedIds(prev => addHighlightedIds(prev, changedIds))

        // Auto-clear highlights after duration
        scheduleHighlightCleanup(changedIds, highlightDuration, timeoutIdsRef, setHighlightedIds)
      })

      return () => {
        isCancelled = true
      }
    }
  }, [rows, highlightDuration, skipInitialAnimation])

  return highlightedIds
}
