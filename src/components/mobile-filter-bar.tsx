import { LabSpecialty } from '@/types'
import { Search } from 'lucide-react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MobileFilterBarProps {
    searchQuery: string
    onSearchChange: (value: string) => void
    specialties: LabSpecialty[]
    selectedSpecialtyId: string
    onSelectSpecialty: (id: string) => void
}

export function MobileFilterBar({
    searchQuery,
    onSearchChange,
    specialties,
    selectedSpecialtyId,
    onSelectSpecialty
}: MobileFilterBarProps) {
    return (
        <div className="sticky top-0 z-40 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur shadow-sm space-y-2 pb-2 transition-all">
            {/* Search Input */}
            <div className="p-3">
                <div className="relative shadow-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm chỉ tiêu..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
            </div>

            {/* Specialty Chips */}
            <div className="pl-3">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2 pb-2 pr-4">
                        <button
                            onClick={() => onSelectSpecialty('all')}
                            className={cn(
                                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border",
                                selectedSpecialtyId === 'all'
                                    ? "bg-slate-800 text-white border-slate-800 shadow-sm scale-105"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            Tất cả
                        </button>
                        {specialties.map((specialty) => (
                            <button
                                key={specialty.id}
                                onClick={() => onSelectSpecialty(specialty.id)}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border",
                                    selectedSpecialtyId === specialty.id
                                        ? "bg-sky-600 text-white border-sky-600 shadow-sky-100 shadow-md scale-105"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                {specialty.name}
                            </button>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>
            </div>
        </div>
    )
}
