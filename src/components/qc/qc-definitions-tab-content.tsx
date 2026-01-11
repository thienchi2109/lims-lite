'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QCDefinitionsTable, type QCDefinitionWithDetails } from './qc-definitions-table'

interface QCDefinitionsTabContentProps {
    definitions: QCDefinitionWithDetails[]
    total: number
    page: number
    pageSize: number
    onEstablishLimits: () => void
}

export function QCDefinitionsTabContent({
    definitions,
    total,
    page,
    pageSize,
    onEstablishLimits,
}: QCDefinitionsTabContentProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Giới hạn kiểm soát</CardTitle>
                        <CardDescription>
                            Cấu hình Mean và SD cho từng xét nghiệm
                        </CardDescription>
                    </div>
                    <Button size="sm" onClick={onEstablishLimits}>
                        <Plus className="h-4 w-4 mr-2" />
                        Thiết lập mới
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <QCDefinitionsTable
                    definitions={definitions}
                    total={total}
                    page={page}
                    pageSize={pageSize}
                />
            </CardContent>
        </Card>
    )
}
