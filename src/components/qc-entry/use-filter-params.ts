'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

interface UseFilterParamsReturn {
    // Current values from URL
    search: string
    specialty: string | null
    status: string | null
    page: number
    // Local search state for debounce
    searchValue: string
    setSearchValue: (value: string) => void
    // Update functions
    updateParam: (key: string, value: string | null) => void
    // Loading state
    isPending: boolean
}

export function useFilterParams(): UseFilterParamsReturn {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    // Parse current URL params
    const search = searchParams.get('q') ?? ''
    const specialty = searchParams.get('specialty')
    const status = searchParams.get('status')
    const page = Number(searchParams.get('page')) || 1

    // Local state for instant UI feedback on search
    const [searchValue, setSearchValue] = useState(search)

    // Generic param updater (resets page to 1)
    const updateParam = useCallback(
        (key: string, value: string | null) => {
            const params = new URLSearchParams(searchParams.toString())

            // Update the target param
            if (value === null || value === '' || value === 'all') {
                params.delete(key)
            } else {
                params.set(key, value)
            }

            // Reset page when filters change (except page itself)
            if (key !== 'page') {
                params.delete('page')
            }

            startTransition(() => {
                const query = params.toString()
                router.replace(query ? `${pathname}?${query}` : pathname)
            })
        },
        [searchParams, pathname, router]
    )

    // Sync local state when URL changes (e.g., browser back)
    useEffect(() => {
        setSearchValue(search)
    }, [search])

    // Debounced URL update for search
    useEffect(() => {
        // Skip if search hasn't changed from URL
        if (searchValue === search) return

        const timer = setTimeout(() => {
            updateParam('q', searchValue || null)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchValue, search, updateParam])

    return {
        search,
        specialty,
        status,
        page,
        searchValue,
        setSearchValue,
        updateParam,
        isPending,
    }
}
