'use client'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ArrowRight } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import type { CurrentMaterial, CurrentDefinition, NewLotForm } from './lot-changeover-types'

interface LotComparisonProps {
    currentMaterial: CurrentMaterial
    definitions: CurrentDefinition[]
    currentCV: number
    form: UseFormReturn<NewLotForm>
}

export function LotComparison({
    currentMaterial,
    definitions,
    currentCV,
    form,
}: LotComparisonProps) {
    const errors = form.formState.errors

    return (
        <div className="grid grid-cols-2 gap-4">
            {/* Current Lot */}
            <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium">Lô hiện tại</h4>
                    <Badge variant="secondary">{currentMaterial.level}</Badge>
                </div>
                <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Tên:</span> {currentMaterial.name}</p>
                    <p><span className="text-muted-foreground">Số lô:</span> <span className="font-mono">{currentMaterial.lot_number}</span></p>
                    <p><span className="text-muted-foreground">Mean:</span> <span className="font-mono">{definitions[0]?.mean ?? 'N/A'}</span></p>
                    <p><span className="text-muted-foreground">SD:</span> <span className="font-mono">{definitions[0]?.sd ?? 'N/A'}</span></p>
                    <p><span className="text-muted-foreground">CV%:</span> <span className="font-mono">{currentCV.toFixed(2)}%</span></p>
                </div>
            </div>

            {/* New Lot Form */}
            <div className="rounded-lg border p-4 space-y-3 border-primary">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium">Lô mới</h4>
                    <ArrowRight className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-2">
                    <div>
                        <Label htmlFor="lot_number">Số lô mới *</Label>
                        <Input
                            id="lot_number"
                            {...form.register('lot_number')}
                            placeholder="VD: 12345678"
                            className={errors.lot_number ? 'border-destructive' : ''}
                        />
                    </div>
                    <div>
                        <Label htmlFor="expiry_date">Ngày hết hạn *</Label>
                        <Input
                            id="expiry_date"
                            type="date"
                            {...form.register('expiry_date')}
                            className={errors.expiry_date ? 'border-destructive' : ''}
                        />
                    </div>
                    <div>
                        <Label htmlFor="level">Mức</Label>
                        <Select
                            value={form.watch('level')}
                            onValueChange={(val) => form.setValue('level', val as 'low' | 'normal' | 'high')}
                        >
                            <SelectTrigger id="level">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Thấp</SelectItem>
                                <SelectItem value="normal">Bình thường</SelectItem>
                                <SelectItem value="high">Cao</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    )
}
