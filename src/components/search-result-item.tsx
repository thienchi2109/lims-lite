'use client'

/**
 * Search Result Item Component
 *
 * Displays entity-specific search results with:
 * - Entity type icons
 * - Formatted descriptions
 * - Link to entity detail page
 * - Relevance rank score
 *
 * Used by GlobalSearch component for consistent result rendering.
 */

import { LucideIcon } from 'lucide-react'
import { CommandItem } from '@/components/ui/command'
import type { GlobalSearchResult } from '@/types'

interface SearchResultItemProps {
    result: GlobalSearchResult
    icon: LucideIcon
    onSelect: () => void
}

export function SearchResultItem({ result, icon: Icon, onSelect }: SearchResultItemProps) {
    return (
        <CommandItem
            key={`${result.entity_type}-${result.entity_id}`}
            value={`${result.entity_type}-${result.entity_id}-${result.description}`}
            onSelect={onSelect}
        >
            <Icon className="mr-2 h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{result.description}</div>
            </div>
            <div className="ml-2 text-xs text-muted-foreground tabular-nums shrink-0">
                {Math.round(result.rank * 100)}%
            </div>
        </CommandItem>
    )
}
