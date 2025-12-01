'use client'

import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect, useRef } from 'react'

interface SearchInputProps {
    placeholder?: string
    className?: string
}

export function SearchInput({
    placeholder = 'Tìm kiếm...',
    className,
}: SearchInputProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const initialSearch = searchParams.get('search')?.toString() || ''
    const [term, setTerm] = useState(initialSearch)
    const lastSubmittedTerm = useRef(initialSearch)

    // Sync local state with URL if URL changes externally (e.g. back button)
    useEffect(() => {
        const currentSearchParam = searchParams.get('search')?.toString() || ''
        // Only update local state if the new param is different from what we last submitted
        // This prevents overwriting the user's input during the race condition where
        // the router updates with the previous keystroke while the user is still typing
        if (currentSearchParam !== lastSubmittedTerm.current) {
            setTerm(currentSearchParam)
            lastSubmittedTerm.current = currentSearchParam
        }
    }, [searchParams])

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // Only update if the term in URL is different from current term
            const currentSearch = searchParams.get('search')?.toString() || ''
            if (term === currentSearch) return

            const params = new URLSearchParams(searchParams)
            if (term) {
                params.set('search', term)
            } else {
                params.delete('search')
            }
            // Reset page to 1 when searching
            params.set('page', '1')

            // Update ref BEFORE calling replace, so the sync effect knows to ignore it
            lastSubmittedTerm.current = term

            startTransition(() => {
                router.replace(`${pathname}?${params.toString()}`)
            })
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [term, pathname, router, searchParams])

    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
                type="search"
                placeholder={placeholder}
                className="pl-9 bg-background"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
            />
        </div>
    )
}
