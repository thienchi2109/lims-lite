'use client'

import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QCMaterialsList, type QCMaterial } from './qc-materials-list'
import { LotChangeoverDialog } from './lot-changeover-dialog'
import { QCMaterialDialog } from './qc-material-dialog'
import type { QCDefinitionWithDetails } from './qc-definitions-table'

interface QCMaterialsTabContentProps {
    materials: QCMaterial[]
    definitions: QCDefinitionWithDetails[]
    // Pagination props
    total: number
    page: number
    pageSize: number
    search: string
    level: 'low' | 'normal' | 'high' | null
    status: 'valid' | 'expiring_soon' | 'expired' | null
}

export function QCMaterialsTabContent({
    materials,
    definitions,
    total,
    page,
    pageSize,
    search,
    level,
    status,
}: QCMaterialsTabContentProps) {
    const [showAddMaterial, setShowAddMaterial] = useState(false)

    // Get first material for LotChangeoverDialog (requires currentMaterial)
    const firstMaterial = materials[0] ? {
        id: materials[0].id,
        name: materials[0].name,
        manufacturer: materials[0].manufacturer || '',
        lot_number: materials[0].lot_number,
        level: materials[0].level,
        expiry_date: materials[0].expiry_date || '',
    } : null

    // Transform definitions for LotChangeoverDialog
    const definitionsForChangeover = definitions.map(d => ({
        id: d.id,
        mean: d.mean,
        sd: d.sd,
        cv_percent: d.cv_percent,
        assay: { id: d.assay_id, name: d.assay_name, units: d.assay_units },
    }))

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Vật liệu QC</CardTitle>
                            <CardDescription>
                                Quản lý vật liệu kiểm soát chất lượng
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => setShowAddMaterial(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Thêm vật liệu
                            </Button>
                            {firstMaterial && (
                                <LotChangeoverDialog
                                    currentMaterial={firstMaterial}
                                    definitions={definitionsForChangeover}
                                    trigger={
                                        <Button size="sm">
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Chuyển lô
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <QCMaterialsList
                        materials={materials}
                        total={total}
                        page={page}
                        pageSize={pageSize}
                        search={search}
                        level={level}
                        status={status}
                    />
                </CardContent>
            </Card>

            {/* Add Material Dialog */}
            <QCMaterialDialog
                open={showAddMaterial}
                onOpenChange={setShowAddMaterial}
                mode="create"
            />
        </>
    )
}
