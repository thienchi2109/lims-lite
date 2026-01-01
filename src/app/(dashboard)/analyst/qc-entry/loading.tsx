import { Skeleton } from '@/components/ui/skeleton'

export default function QCEntryLoading() {
    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-6">
            {/* Header skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
            </div>

            {/* Tabs skeleton */}
            <div className="space-y-4">
                <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-24" />
                    ))}
                </div>

                {/* Assay cards skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-3">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-24" />
                            <div className="flex gap-4">
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-8 w-16" />
                            </div>
                            <Skeleton className="h-32 w-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
