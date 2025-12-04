'use client'

import { useEffect, useState } from 'react'
import { getResultsBySample } from '@/app/actions/results'
import { ResultsGrid } from '@/components/results-grid'
import { Button } from '@/components/ui/button'
import { X, RefreshCcw, FileText } from 'lucide-react'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { ResultWithAssay, SampleWithUser } from '@/types'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'

interface SampleResultsViewProps {
    sample: SampleWithUser
    userRole: 'analyst' | 'manager'
    onClose: () => void
}

export function SampleResultsView({ sample, userRole, onClose }: SampleResultsViewProps) {
    const [results, setResults] = useState<ResultWithAssay[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const fetchResults = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await getResultsBySample(sample.id)
            if (error) {
                setError(error)
            } else {
                setResults(data || [])
            }
        } catch (err) {
            setError('Failed to load results')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchResults()
    }, [sample.id])

    const handleSaveSuccess = () => {
        fetchResults()
        router.refresh()
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-950 border rounded-lg overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className="h-8 w-8 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                                {sample.sample_id}
                            </h3>
                            <SampleStatusBadge status={sample.status} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                            {sample.client_name || 'N/A'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={fetchResults}
                        disabled={loading}
                        title="Làm mới"
                        className="h-8 w-8 text-slate-500 hover:text-sky-600 hover:bg-sky-50"
                    >
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClose}
                        title="Đóng"
                        className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm z-20">
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCcw className="h-8 w-8 animate-spin text-sky-500" />
                            <p className="text-sm text-muted-foreground font-medium">Đang tải kết quả...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div className="text-center max-w-md p-6 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50">
                            <p className="text-rose-600 dark:text-rose-400 font-medium mb-2">Không thể tải kết quả</p>
                            <p className="text-sm text-rose-500/80 dark:text-rose-400/80 mb-4">{error}</p>
                            <Button variant="outline" size="sm" onClick={fetchResults} className="border-rose-200 hover:bg-rose-100 text-rose-700">
                                Thử lại
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-0">
                        <ResultsGrid
                            results={results}
                            sampleId={sample.id}
                            userRole={userRole}
                            onSaveSuccess={handleSaveSuccess}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
