import React from 'react'
import type { AssayDefinitionWithMethods, SelectedTest } from '@/types'
import { X, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface SelectionPanelProps {
    selected: SelectedTest[]
    onChange: (tests: SelectedTest[]) => void
    handleRemove: (assayId: string) => void
    handleMethodChange: (assayId: string, methodId: string) => void
    availableAssays: AssayDefinitionWithMethods[]
    onSave?: () => void
    isSaving?: boolean
    isSaveDisabled?: boolean
    saveLabel?: string
}

export function SelectionPanel({
    selected,
    onChange,
    handleRemove,
    handleMethodChange,
    availableAssays,
    onSave,
    isSaving = false,
    isSaveDisabled = false,
    saveLabel = 'Lưu thay đổi'
}: SelectionPanelProps) {
    return (
        <aside className="h-full bg-white dark:bg-slate-950 flex flex-col z-30">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {selected.length}
                    </div>
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Đã chọn</h2>
                </div>
                <button
                    onClick={() => onChange([])}
                    className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-600 tracking-wider"
                    disabled={selected.length === 0}
                >
                    Xóa hết
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
                {selected.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <div className="w-10 h-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center mb-2">
                            <Plus size={16} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Chọn chỉ tiêu từ danh sách</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {selected.map((test) => (
                                <tr key={test.assayId} className="group hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                                    <td className="p-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-tight">{test.assayName}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">PP: {test.methodName}</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemove(test.assayId)}
                                                className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                {onSave && (
                    <Button
                        id="tour-save-button"
                        onClick={onSave}
                        disabled={isSaving || isSaveDisabled}
                        className="w-full"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            saveLabel
                        )}
                    </Button>
                )}
            </div>
        </aside>
    )
}
