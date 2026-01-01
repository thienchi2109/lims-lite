'use client'

import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { AssayOption, MaterialOption } from './control-limits-types'

interface Step1SelectionProps {
    assays: AssayOption[]
    materials: MaterialOption[]
    selectedAssayId: string
    selectedMaterialId: string
    onAssayChange: (id: string) => void
    onMaterialChange: (id: string) => void
}

export function Step1Selection({
    assays,
    materials,
    selectedAssayId,
    selectedMaterialId,
    onAssayChange,
    onMaterialChange,
}: Step1SelectionProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="assay">Xét nghiệm</Label>
                <Select value={selectedAssayId} onValueChange={onAssayChange}>
                    <SelectTrigger id="assay">
                        <SelectValue placeholder="Chọn xét nghiệm..." />
                    </SelectTrigger>
                    <SelectContent>
                        {assays.map(assay => (
                            <SelectItem key={assay.id} value={assay.id}>
                                {assay.name} {assay.units && `(${assay.units})`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="material">Vật liệu QC</Label>
                <Select value={selectedMaterialId} onValueChange={onMaterialChange}>
                    <SelectTrigger id="material">
                        <SelectValue placeholder="Chọn vật liệu QC..." />
                    </SelectTrigger>
                    <SelectContent>
                        {materials.map(material => (
                            <SelectItem key={material.id} value={material.id}>
                                {material.name} - {material.level} (Lô: {material.lot_number})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}
