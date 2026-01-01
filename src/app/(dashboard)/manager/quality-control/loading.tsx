import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function QualityControlLoading() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header skeleton */}
            <div className="border-b bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <Skeleton className="h-4 w-24 mb-4" />
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-4 w-96" />
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Back button skeleton */}
                <Skeleton className="h-9 w-24" />

                {/* Tabs skeleton */}
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="overview" disabled>
                            Tổng quan
                        </TabsTrigger>
                        <TabsTrigger value="materials" disabled>
                            Vật liệu QC
                        </TabsTrigger>
                        <TabsTrigger value="sessions" disabled>
                            Phiên QC
                        </TabsTrigger>
                        <TabsTrigger value="charts" disabled>
                            Biểu đồ L-J
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        {/* Summary cards skeleton */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <Card key={i}>
                                    <CardHeader className="pb-2">
                                        <Skeleton className="h-4 w-24" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-8 w-16" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Table skeleton */}
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-64" />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    )
}
