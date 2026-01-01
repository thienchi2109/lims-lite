'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import { QCAssayCard } from './qc-assay-card'

// ============================================================================
// TYPES
// ============================================================================

interface SpecialtyWithQC {
    id: string
    name: string
    qc_count: number
}

interface AssayWithQC {
    id: string
    name: string
    units: string | null
    specialty_id: string
    definition_id: string
    mean: number
    sd: number
    material_name: string
    material_level: string
    lot_number: string
    session_id: string | null
    qc_status: string | null
}

interface QCEntryPageClientProps {
    user: { full_name: string; role: string }
    specialties: SpecialtyWithQC[]
    assays: AssayWithQC[]
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QCEntryPageClient({
    user,
    specialties,
    assays,
}: QCEntryPageClientProps) {
    // Default to first specialty with QC definitions, or first specialty
    const firstWithQC = specialties.find(s => s.qc_count > 0)
    const [activeTab, setActiveTab] = useState(firstWithQC?.id || specialties[0]?.id || '')

    // Filter assays for current specialty
    const currentAssays = assays.filter(a => a.specialty_id === activeTab)

    // Check if any specialty has QC
    const hasAnyQC = specialties.some(s => s.qc_count > 0)

    return (
        <>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href="/samples">
                            <Button variant="ghost" size="sm" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Quay lại danh sách mẫu
                            </Button>
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <Activity className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight">
                            Kiểm soát chất lượng nội bộ (IQC)
                        </h1>
                    </div>
                    <p className="text-muted-foreground">
                        Kiểm nghiệm viên: <span className="text-foreground font-medium">{user.full_name}</span>
                    </p>
                </div>
            </div>

            {/* Empty state when no QC is configured */}
            {!hasAnyQC && (
                <div className="border rounded-lg p-8 text-center space-y-4 bg-muted/50">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div className="space-y-2">
                        <h3 className="text-lg font-medium">Chưa có cấu hình QC</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Chưa có xét nghiệm nào được thiết lập kiểm soát chất lượng.
                            Vui lòng liên hệ Quản lý phòng xét nghiệm để thiết lập giới hạn kiểm soát.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/manager/quality-control">
                            <Settings className="mr-2 h-4 w-4" />
                            Đến trang Quản lý QC
                        </Link>
                    </Button>
                </div>
            )}

            {/* Specialty Tabs */}
            {hasAnyQC && specialties.length > 0 && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="flex-wrap h-auto gap-1">
                        {specialties.map(spec => (
                            <TabsTrigger
                                key={spec.id}
                                value={spec.id}
                                disabled={spec.qc_count === 0}
                                className="gap-2 data-[disabled]:opacity-50"
                            >
                                {spec.name}
                                <Badge
                                    variant={spec.qc_count > 0 ? 'secondary' : 'outline'}
                                    className="ml-1 h-5 min-w-5 px-1.5"
                                >
                                    {spec.qc_count}
                                </Badge>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {specialties.map(spec => (
                        <TabsContent key={spec.id} value={spec.id} className="mt-4">
                            {spec.qc_count === 0 ? (
                                <div className="border rounded-lg p-6 text-center text-muted-foreground">
                                    Chưa có xét nghiệm QC cho chuyên khoa này
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {currentAssays.map(assay => (
                                        <QCAssayCard
                                            key={assay.definition_id}
                                            assay={assay}
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </>
    )
}
