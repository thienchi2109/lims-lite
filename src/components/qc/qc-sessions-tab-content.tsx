'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QCSessionsTable } from './qc-sessions-table'
import type { QCSessionRow } from '@/types/qc'

interface Specialty {
    id: string
    name: string
}

interface Assay {
    id: string
    name: string
    units: string | null
    specialty_id: string | null
}

interface QCSessionsTabContentProps {
    specialties: Specialty[]
    assays: Assay[]
    sessionsData: QCSessionRow[]
    sessionsTotal: number
    sessionsTotalPages: number
    sessionsPage: number
    sessionsPageSize: number
}

export function QCSessionsTabContent({
    specialties,
    assays,
    sessionsData,
    sessionsTotal,
    sessionsTotalPages,
    sessionsPage,
    sessionsPageSize,
}: QCSessionsTabContentProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Quản lý phiên QC</CardTitle>
                <CardDescription>
                    Xem, lọc và quản lý tất cả các phiên QC
                </CardDescription>
            </CardHeader>
            <CardContent>
                <QCSessionsTable
                    specialties={specialties}
                    assays={assays.map(a => ({ id: a.id, name: a.name }))}
                    initialData={{
                        data: sessionsData,
                        total: sessionsTotal,
                        page: sessionsPage,
                        page_size: sessionsPageSize,
                        total_pages: sessionsTotalPages,
                    }}
                />
            </CardContent>
        </Card>
    )
}
