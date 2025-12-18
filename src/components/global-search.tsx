'use client'

/**
 * Global Search Component
 *
 * Features:
 * - Visual search trigger button with keyboard shortcut hint
 * - Command palette with Cmd/Ctrl+K shortcut
 * - Debounced search (300ms) to reduce server load
 * - Entity-specific results grouping
 * - Keyboard navigation support
 * - Vietnamese UI labels
 * - Real-time search across all entities
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, Users, Beaker, ClipboardList } from 'lucide-react'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { SearchResultItem } from '@/components/search-result-item'
import { useGlobalSearch } from '@/hooks/use-search'
import type { GlobalSearchResult } from '@/types'

// Valid entity types
type EntityType = 'sample' | 'client' | 'assay' | 'result'

export function GlobalSearch() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const router = useRouter()

    // Debounce search query (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query)
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    // Fetch search results using debounced query
    const { data: results, isLoading } = useGlobalSearch({
        query: debouncedQuery,
        maxResults: 20,
        enabled: debouncedQuery.trim().length >= 2,
    })

    // Register Cmd/Ctrl+K keyboard shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    // Handle result selection
    const handleSelect = useCallback((result: GlobalSearchResult) => {
        setOpen(false)
        setQuery('')
        setDebouncedQuery('')

        // Navigate to entity detail page
        switch (result.entity_type) {
            case 'sample':
                router.push(`/analyst/samples/${result.entity_id}`)
                break
            case 'client':
                router.push(`/manager/clients?id=${result.entity_id}`)
                break
            case 'assay':
                router.push(`/manager/assays?id=${result.entity_id}`)
                break
            case 'result':
                router.push(`/analyst/results?id=${result.entity_id}`)
                break
        }
    }, [router])

    // Group results by entity type (memoized)
    const groupedResults = useMemo(() => {
        return results?.reduce((acc, result) => {
            if (!acc[result.entity_type]) {
                acc[result.entity_type] = []
            }
            acc[result.entity_type].push(result)
            return acc
        }, {} as Record<string, GlobalSearchResult[]>)
    }, [results])

    // Entity type labels and icons with strict typing
    const entityConfig: Record<EntityType, { label: string; icon: typeof FileText }> = {
        sample: { label: 'Mẫu', icon: FileText },
        client: { label: 'Khách hàng', icon: Users },
        assay: { label: 'Chỉ tiêu', icon: Beaker },
        result: { label: 'Kết quả', icon: ClipboardList },
    }

    return (
        <>
            {/* Visual Trigger Button */}
            <Button
                variant="outline"
                className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2 text-muted-foreground"
                onClick={() => setOpen(true)}
            >
                <Search className="h-4 w-4 xl:mr-2" />
                <span className="hidden xl:inline-flex">Tìm kiếm...</span>
                <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </Button>

            {/* Search Dialog */}
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput
                    placeholder="Tìm kiếm mẫu, khách hàng, chỉ tiêu..."
                    value={query}
                    onValueChange={setQuery}
                />
                <CommandList>
                    {/* Distinct Loading State */}
                    {isLoading && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            Đang tìm kiếm...
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && <CommandEmpty>Không tìm thấy kết quả</CommandEmpty>}

                    {/* Results Grouped by Entity Type */}
                    {!isLoading && groupedResults && Object.entries(groupedResults).map(([entityType, items], index) => {
                        const config = entityConfig[entityType as EntityType] || {
                            label: entityType,
                            icon: Search
                        }
                        const Icon = config.icon

                        return (
                            <div key={entityType}>
                                {index > 0 && <CommandSeparator />}
                                <CommandGroup heading={config.label}>
                                    {items.map((result) => (
                                        <SearchResultItem
                                            key={`${result.entity_type}-${result.entity_id}`}
                                            result={result}
                                            icon={Icon}
                                            onSelect={() => handleSelect(result)}
                                        />
                                    ))}
                                </CommandGroup>
                            </div>
                        )
                    })}
                </CommandList>
            </CommandDialog>
        </>
    )
}
