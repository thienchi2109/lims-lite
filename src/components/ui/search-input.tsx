'use client'

import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'

interface SearchInputProps {
    placeholder?: string
    className?: string
}

type SearchDraft = {
    baseSearch: string
    value: string
}

export function SearchInput({
    placeholder = 'Tìm kiếm...',
    className,
}: SearchInputProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [, startTransition] = useTransition()

    const currentSearch = searchParams.get('search')?.toString() || ''
    const [searchDraft, setSearchDraft] = useState<SearchDraft | null>(null)
    const term = searchDraft?.baseSearch === currentSearch ? searchDraft.value : currentSearch

    useEffect(() => {
        let cancelled = false

        queueMicrotask(() => {
            if (cancelled) return
            setSearchDraft((currentDraft) => {
                if (!currentDraft || currentDraft.baseSearch === currentSearch) return currentDraft
                return null
            })
        })

        return () => {
            cancelled = true
        }
    }, [currentSearch])

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // Only update if the term in URL is different from current term
            if (term === currentSearch) return

            const params = new URLSearchParams(searchParams)
            if (term) {
                params.set('search', term)
            } else {
                params.delete('search')
            }
            // Reset page to 1 when searching
            params.set('page', '1')

            startTransition(() => {
                router.replace(`${pathname}?${params.toString()}`)
            })
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [currentSearch, term, pathname, router, searchParams])

    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
                type="search"
                placeholder={placeholder}
                className="pl-9 bg-background"
                value={term}
                onChange={(e) => setSearchDraft({
                    baseSearch: currentSearch,
                    value: e.target.value,
                })}
            />
        </div>
    )
}
