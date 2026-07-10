'use client'

import { useState } from 'react'
import { Barcode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    DEFAULT_SAMPLE_LABEL_PRESET,
    type SampleLabelPreset,
} from '@/lib/sample-label-template'

const STORAGE_KEY = 'sample-label-print-preset'

const PRESETS: Array<{
    value: SampleLabelPreset
    label: string
    description: string
}> = [
    {
        value: 'thermal-35x23-sheet-2up',
        label: '35.5 x 22.9mm - template chuẩn',
        description: 'Khớp stock 71.1 x 89mm, 2 cột, không gap trong driver máy in.',
    },
    {
        value: 'thermal-35x22-2up',
        label: '35 x 22mm - 2 tem ngang cũ',
        description: 'Preset cũ cho cấu hình in 72 x 22mm, gap 2mm.',
    },
    {
        value: 'small-tube',
        label: '40 x 15mm - 1 tem',
        description: 'Dành cho cuộn tem đơn kích thước nhỏ.',
    },
    {
        value: 'container',
        label: '50 x 25mm - 1 tem',
        description: 'Dành cho lọ, hộp hoặc nhãn lớn hơn.',
    },
]

interface SampleLabelPrintDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onPrint: (preset: SampleLabelPreset) => void
}

function isSampleLabelPreset(value: string | null): value is SampleLabelPreset {
    return PRESETS.some((preset) => preset.value === value)
}

function getInitialPreset() {
    if (typeof window === 'undefined') return DEFAULT_SAMPLE_LABEL_PRESET

    const savedPreset = window.localStorage.getItem(STORAGE_KEY)
    return isSampleLabelPreset(savedPreset) ? savedPreset : DEFAULT_SAMPLE_LABEL_PRESET
}

export function SampleLabelPrintDialog({
    open,
    onOpenChange,
    onPrint,
}: SampleLabelPrintDialogProps) {
    const [selectedPreset, setSelectedPreset] = useState<SampleLabelPreset>(getInitialPreset)

    const handlePrint = () => {
        window.localStorage.setItem(STORAGE_KEY, selectedPreset)
        onPrint(selectedPreset)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>Cấu hình nhãn barcode</DialogTitle>
                    <DialogDescription>
                        Chọn đúng loại decal trước khi mở cửa sổ in.
                    </DialogDescription>
                </DialogHeader>

                <fieldset className="space-y-2">
                    <legend className="sr-only">Kích thước nhãn barcode</legend>
                    {PRESETS.map((preset) => (
                        <label
                            key={preset.value}
                            className="flex cursor-pointer gap-3 rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                        >
                            <input
                                type="radio"
                                name="sample-label-preset"
                                value={preset.value}
                                aria-label={preset.label}
                                checked={selectedPreset === preset.value}
                                onChange={() => setSelectedPreset(preset.value)}
                                className="mt-1"
                            />
                            <span className="min-w-0">
                                <span className="block font-medium text-slate-900 dark:text-slate-100">
                                    {preset.label}
                                </span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    {preset.description}
                                </span>
                            </span>
                        </label>
                    ))}
                </fieldset>

                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    Khi in: tắt Headers and footers, chọn Margins: None và Scale: 100%.
                </p>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Hủy
                    </Button>
                    <Button type="button" onClick={handlePrint}>
                        <Barcode className="mr-2 h-4 w-4" />
                        In nhãn
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
