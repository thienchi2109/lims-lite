'use client'

import { useCallback, useMemo, useState } from 'react'

export type PendingQueryAction = 'page' | 'filter'

type QueryUpdates = Record<string, string | null | undefined>

interface UsePendingQueryNavigationOptions {
    currentQuery: string
    pathname: string
    replace: (url: string) => void
    isFetching: boolean
}

function buildQueryString(currentQuery: string, updates: QueryUpdates) {
    const params = new URLSearchParams(currentQuery)

    Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
            params.delete(key)
            return
        }

        params.set(key, value)
    })

    if ('page' in updates && updates.page === undefined) {
        params.delete('page')
    }

    return params.toString()
}

export function usePendingQueryNavigation({
    currentQuery,
    pathname,
    replace,
    isFetching,
}: UsePendingQueryNavigationOptions) {
    const [pendingRequest, setPendingRequest] = useState<{
        action: PendingQueryAction
        targetQuery: string
    } | null>(null)

    const isSettled = pendingRequest !== null &&
        pendingRequest.targetQuery === currentQuery &&
        !isFetching
    const pendingAction = isSettled ? null : pendingRequest?.action ?? null

    const updateQuery = useCallback((updates: QueryUpdates, action: PendingQueryAction) => {
        const normalizedUpdates = action === 'filter' && !('page' in updates)
            ? { ...updates, page: '1' }
            : updates
        const nextQuery = buildQueryString(currentQuery, normalizedUpdates)

        if (nextQuery === currentQuery) {
            return
        }

        setPendingRequest({
            action,
            targetQuery: nextQuery,
        })
        replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    }, [currentQuery, pathname, replace])

    return useMemo(() => ({
        pendingAction,
        isPending: pendingAction !== null,
        isPagePending: pendingAction === 'page',
        isFilterPending: pendingAction === 'filter',
        updateQuery,
    }), [pendingAction, updateQuery])
}
