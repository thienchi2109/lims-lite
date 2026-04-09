'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type SampleStatus } from '@/types'
import { SEARCH_DEBOUNCE_MS } from './constants'

export type FilterState = {
    search: string
    scope: 'active' | 'all'
    status: SampleStatus | 'all'
    fromDate: string
    toDate: string
    receiverId: string
    selectedSpecialtyIds: string[]
}

export type FilterHandlers = {
    setSearch: (value: string) => void
    setScope: (value: 'active' | 'all') => void
    setStatus: (value: SampleStatus | 'all') => void
    setDateRange: (range: 'today' | 'yesterday' | 'week' | 'month') => void
    setFromDate: (value: string) => void
    setToDate: (value: string) => void
    setReceiver: (value: string) => void
    toggleSpecialty: (id: string) => void
    resetFilters: () => void
    clearDates: () => void
}

export type SortState = {
    sortBy: string
    sortOrder: 'asc' | 'desc'
    pageSize: number
    currentSortValue: string
    setSortValue: (value: string) => void
    setPageSize: (value: string) => void
}

type SearchDraft = {
    baseSearch: string
    value: string
}

type UseFilterParamsProps = {
    defaultSortBy?: string
    defaultSortOrder?: 'asc' | 'desc'
    defaultPageSize?: number
}

export function useFilterParams({
    defaultSortBy = 'updated_at',
    defaultSortOrder = 'desc',
    defaultPageSize = 20,
}: UseFilterParamsProps = {}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])

    // Single derivation from URL - fixes Bug #4 (Prop-State Sync)
    const filters = useMemo((): FilterState => {
        const params = new URLSearchParams(searchParamsString)
        return {
            search: params.get('search') || '',
            scope: params.get('scope') === 'all' ? 'all' : 'active',
            status: (params.get('status') as SampleStatus) || 'all',
            fromDate: params.get('fromDate') || '',
            toDate: params.get('toDate') || '',
            receiverId: params.get('receiverId') || '',
            selectedSpecialtyIds: params.get('specialtyIds')?.split(',').filter(Boolean) || [],
        }
    }, [searchParamsString])

    // Search needs local state for debouncing while still deriving external URL updates.
    const [searchDraft, setSearchDraft] = useState<SearchDraft | null>(null)
    const isSearchInputFocused =
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement.dataset.searchInput === 'true'
    const hasActiveSearchDraft =
        searchDraft !== null &&
        (isSearchInputFocused || searchDraft.baseSearch === filters.search)
    const searchValue = hasActiveSearchDraft ? searchDraft.value : filters.search

    // URL update helper
    const updateUrl = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParamsString)
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === '') {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        params.set('page', '1')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
    }, [searchParamsString, router, pathname])

    // Isolated debounce effect - fixes Bug #3 (Search Debounce Interference)
    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams(window.location.search)
            const currentSearch = params.get('search') || ''

            if (currentSearch !== searchValue) {
                const newParams = new URLSearchParams(window.location.search)
                if (searchValue) {
                    newParams.set('search', searchValue)
                } else {
                    newParams.delete('search')
                }
                newParams.set('page', '1')
                const query = newParams.toString()
                router.replace(query ? `${pathname}?${query}` : pathname)
            }
        }, SEARCH_DEBOUNCE_MS)

        return () => clearTimeout(timer)
    }, [searchValue, pathname, router])

    // Handler implementations
    const handlers: FilterHandlers = useMemo(() => ({
        setSearch: (value: string) => {
            setSearchDraft({
                baseSearch: filters.search,
                value,
            })
        },

        setScope: (value: 'active' | 'all') => {
            updateUrl({ scope: value === 'all' ? value : null })
        },

        setStatus: (value: SampleStatus | 'all') => {
            updateUrl({ status: value === 'all' ? null : value })
        },

        // Fixes Bug #2 (Date Preset Logic) - always sets BOTH dates
        setDateRange: (range: 'today' | 'yesterday' | 'week' | 'month') => {
            const today = new Date()
            const from = new Date()
            const to = new Date()

            switch (range) {
                case 'today':
                    // from and to are both today
                    break
                case 'yesterday':
                    from.setDate(today.getDate() - 1)
                    to.setDate(today.getDate() - 1)
                    break
                case 'week':
                    from.setDate(today.getDate() - 7)
                    // to stays as today
                    break
                case 'month':
                    from.setDate(1)
                    // to stays as today
                    break
            }

            const fromStr = from.toISOString().split('T')[0]
            const toStr = to.toISOString().split('T')[0]
            updateUrl({ fromDate: fromStr, toDate: toStr })
        },

        setFromDate: (value: string) => {
            updateUrl({ fromDate: value || null })
        },

        setToDate: (value: string) => {
            updateUrl({ toDate: value || null })
        },

        setReceiver: (value: string) => {
            updateUrl({ receiverId: value === 'all' ? null : value })
        },

        toggleSpecialty: (id: string) => {
            const newIds = filters.selectedSpecialtyIds.includes(id)
                ? filters.selectedSpecialtyIds.filter(sid => sid !== id)
                : [...filters.selectedSpecialtyIds, id]
            updateUrl({ specialtyIds: newIds.length > 0 ? newIds.join(',') : null })
        },

        // Fixes Bug #1 (Aggressive Reset) - preserves pageSize & sortBy
        resetFilters: () => {
            const params = new URLSearchParams(searchParamsString)
            params.delete('search')
            params.delete('scope')
            params.delete('status')
            params.delete('fromDate')
            params.delete('toDate')
            params.delete('receiverId')
            params.delete('specialtyIds')
            params.set('page', '1')
            // Preserve: pageSize, sortBy, sortOrder
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname)
            setSearchDraft({
                baseSearch: filters.search,
                value: '',
            })
        },

        clearDates: () => {
            updateUrl({ fromDate: null, toDate: null })
        },
    }), [updateUrl, filters.selectedSpecialtyIds, filters.search, searchParamsString, router, pathname])

    // Sort state
    const sort: SortState = useMemo(() => {
        const params = new URLSearchParams(searchParamsString)
        const sortBy = params.get('sortBy') || defaultSortBy
        const sortOrder = (params.get('sortOrder') as 'asc' | 'desc') || defaultSortOrder
        const pageSize = parseInt(params.get('pageSize') || String(defaultPageSize), 10)

        return {
            sortBy,
            sortOrder,
            pageSize,
            currentSortValue: `${sortBy}-${sortOrder}`,
            setSortValue: (value: string) => {
                const [newSortBy, newSortOrder] = value.split('-')
                updateUrl({ sortBy: newSortBy, sortOrder: newSortOrder })
            },
            setPageSize: (value: string) => {
                updateUrl({ pageSize: value })
            },
        }
    }, [searchParamsString, defaultSortBy, defaultSortOrder, defaultPageSize, updateUrl])

    // Active filters count
    const activeFiltersCount = useMemo(() => {
        return [
            filters.status !== 'all',
            filters.receiverId !== '',
            filters.fromDate !== '',
            filters.toDate !== '',
            filters.selectedSpecialtyIds.length > 0,
        ].filter(Boolean).length
    }, [filters])

    return {
        filters: { ...filters, search: searchValue },
        handlers,
        sort,
        activeFiltersCount,
    }
}
