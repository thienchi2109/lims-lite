import { SelectedTest } from '@/types'
import { Button } from '@/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    SheetClose
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ShoppingCart, X, Trash2, ChevronUp, Beaker, Check, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileBottomBarProps {
    selectedCount: number
    selectedTests: SelectedTest[]
    onSave: () => void
    onRemoveTest: (assayId: string) => void
    onClearAll: () => void
    isSaving: boolean
}

export function MobileBottomBar({
    selectedCount,
    selectedTests,
    onSave,
    onRemoveTest,
    onClearAll,
    isSaving
}: MobileBottomBarProps) {
    // Hidden state: "Chưa chọn chỉ tiêu"
    // We only show the bar when there is at least 1 selection, or we can show a "disabled" hints state.
    // Spec says: "Empty: 'Choose tests to continue' (Disabled button)"

    // We'll implementing a transitioning bottom bar.

    return (
        <Sheet>
            <div className={cn(
                "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out safe-area-bottom",
                // If 0 selected, we still show the bar but visually distinct? 
                // Let's stick to the spec: "State Empty: Choose tests to continue"
                "transform translate-y-0"
            )}>
                {/* The Bar Itself */}
                <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-4 flex items-center justify-between gap-4">

                    {/* Left: Status */}
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "relative flex items-center justify-center w-10 h-10 rounded-full transition-colors",
                            selectedCount > 0 ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-400"
                        )}>
                            <Beaker className="w-5 h-5" />
                            {selectedCount > 0 && (
                                <span
                                    key={selectedCount}
                                    className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in duration-300"
                                >
                                    {selectedCount}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col">
                            {selectedCount > 0 ? (
                                <>
                                    <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Đã chọn</span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedCount} chỉ tiêu</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-sm font-medium text-slate-500">Chưa chọn chỉ tiêu</span>
                                    <span className="text-xs text-slate-400">Vui lòng chọn từ danh sách</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: Action */}
                    {selectedCount > 0 ? (
                        <SheetTrigger asChild>
                            <Button size="lg" className="bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-200 font-semibold px-6 transition-all active:scale-95">
                                Xem lại
                                <ChevronUp className="ml-2 h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                    ) : (
                        <Button size="lg" disabled variant="secondary" className="bg-slate-100 text-slate-400 border border-slate-200">
                            Tiếp tục
                        </Button>
                    )}
                </div>
            </div>

            {/* Sheet Content (The Cart) */}
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[20px] p-0 flex flex-col border-t-0 shadow-2xl">
                {/* Visual Handle */}
                <div className="w-full flex justify-center pt-3 pb-1" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>

                <SheetHeader className="px-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center justify-between mt-2">
                        <SheetTitle className="text-xl font-bold text-slate-900">Danh sách đã chọn</SheetTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClearAll}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-9 px-3"
                        >
                            <Trash2 size={16} className="mr-2" />
                            Xóa tất cả
                        </Button>
                    </div>
                    <div className="text-sm text-slate-500 font-medium">
                        Bạn đã chọn {selectedCount} chỉ tiêu xét nghiệm
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="p-4 space-y-3">
                        {selectedTests.map((test) => (
                            <div key={test.assayId} className="group relative bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-3 transition-all hover:shadow-md">
                                <div className="mt-1 h-8 w-8 rounded-full bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center flex-shrink-0 text-sky-600">
                                    <Check size={16} strokeWidth={3} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                                        {test.assayName}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                        <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 font-medium">
                                            {test.methodName}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onRemoveTest(test.assayId)}
                                    className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 -mr-2 rounded-full"
                                >
                                    <X size={20} />
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 safe-area-bottom">
                    <SheetClose asChild>
                        <Button
                            onClick={onSave}
                            disabled={isSaving}
                            className="w-full bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-200 h-12 text-base font-semibold rounded-xl"
                            size="lg"
                        >
                            {isSaving ? (
                                <>Đang xử lý...</>
                            ) : (
                                <>
                                    Xác nhận & Chỉ định
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </>
                            )}
                        </Button>
                    </SheetClose>
                </div>
            </SheetContent>
        </Sheet>
    )
}
