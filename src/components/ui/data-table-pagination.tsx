'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const DEFAULT_PAGE_SIZE = 20
const DEFAULT_PAGE = 1

export interface DataTablePaginationProps {
    page: number
    pageSize: number
    total: number
    /** URL param prefix (e.g., 'mat_' produces mat_page, mat_size) */
    paramPrefix?: string
    /** Show numbered page buttons. Default: true */
    showPageNumbers?: boolean
    /** Show page size selector. Default: true */
    showPageSize?: boolean
    /** Show first/last page buttons. Default: true */
    showFirstLast?: boolean
    /** Available page size options. Default: [10, 20, 50] */
    pageSizeOptions?: number[]
    /** Default page size (removed from URL when matching). Default: 20 */
    defaultPageSize?: number
}

export function DataTablePagination({
    page,
    pageSize,
    total,
    paramPrefix = '',
    showPageNumbers = true,
    showPageSize = true,
    showFirstLast = true,
    pageSizeOptions = [...DEFAULT_PAGE_SIZE_OPTIONS],
    defaultPageSize = DEFAULT_PAGE_SIZE,
}: DataTablePaginationProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const totalPages = Math.ceil(total / pageSize)
    const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
    const endItem = Math.min(page * pageSize, total)

    // Build param keys with prefix
    const pageParamKey = `${paramPrefix}page`
    const sizeParamKey = `${paramPrefix}size`

    const updateParams = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        const queryString = params.toString()
        router.push(queryString ? `?${queryString}` : window.location.pathname, { scroll: false })
    }, [router, searchParams])

    const handlePageChange = useCallback((newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return
        // Remove page param from URL when it equals default (1)
        updateParams({ [pageParamKey]: newPage === DEFAULT_PAGE ? null : String(newPage) })
    }, [totalPages, updateParams, pageParamKey])

    const handlePageSizeChange = useCallback((newSize: string) => {
        const sizeValue = parseInt(newSize, 10)
        // Remove size param from URL when it equals default, reset page to 1
        updateParams({
            [sizeParamKey]: sizeValue === defaultPageSize ? null : newSize,
            [pageParamKey]: null,
        })
    }, [updateParams, sizeParamKey, pageParamKey, defaultPageSize])

    // Generate page numbers: first, last, +/-2 around current
    const getPageNumbers = (): (number | 'ellipsis')[] => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
        const pages: (number | 'ellipsis')[] = [1]
        if (page > 4) pages.push('ellipsis')
        for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) {
            if (!pages.includes(i)) pages.push(i)
        }
        if (page < totalPages - 3) pages.push('ellipsis')
        if (!pages.includes(totalPages)) pages.push(totalPages)
        return pages
    }

    if (total === 0) return null

    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <div className="text-muted-foreground">
                Hiển thị <span className="font-medium text-foreground">{startItem}</span>
                {' - '}<span className="font-medium text-foreground">{endItem}</span>
                {' của '}<span className="font-medium text-foreground">{total}</span> kết quả
            </div>
            <div className="flex items-center gap-4">
                {showPageSize && (
                    <div className="flex items-center gap-2">
                        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                            <SelectTrigger size="sm" className="w-[70px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {pageSizeOptions.map(size => (
                                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">mỗi trang</span>
                    </div>
                )}
                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        {showFirstLast && (
                            <Button variant="outline" size="icon-sm" onClick={() => handlePageChange(1)}
                                disabled={page === 1} title="Trang đầu">
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="outline" size="icon-sm" onClick={() => handlePageChange(page - 1)}
                            disabled={page === 1} title="Trang trước">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {showPageNumbers && getPageNumbers().map((pageNum, idx) =>
                            pageNum === 'ellipsis' ? (
                                <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
                            ) : (
                                <Button key={pageNum} variant={pageNum === page ? 'default' : 'outline'}
                                    size="icon-sm" onClick={() => handlePageChange(pageNum)} className="min-w-8">
                                    {pageNum}
                                </Button>
                            )
                        )}
                        <Button variant="outline" size="icon-sm" onClick={() => handlePageChange(page + 1)}
                            disabled={page === totalPages} title="Trang sau">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        {showFirstLast && (
                            <Button variant="outline" size="icon-sm" onClick={() => handlePageChange(totalPages)}
                                disabled={page === totalPages} title="Trang cuối">
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
