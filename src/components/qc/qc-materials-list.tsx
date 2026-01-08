import { QCMaterialsFilterBar } from './qc-materials-filter-bar'
import { QCMaterialsTable, type QCMaterial } from './qc-materials-table'
import { QCMaterialsPagination } from './qc-materials-pagination'

interface QCMaterialsListProps {
    materials: QCMaterial[]
    total: number
    page: number
    pageSize: number
    search: string
    level: string | null
    status: string | null
}

/**
 * Orchestrator component for QC Materials list view.
 * Composes filter bar, data table, and pagination components.
 *
 * All state is managed via URL search params by child components.
 * This component simply passes server-computed props to its children.
 */
export function QCMaterialsList({
    materials,
    total,
    page,
    pageSize,
    search,
    level,
    status,
}: QCMaterialsListProps) {
    return (
        <div className="space-y-4">
            <QCMaterialsFilterBar
                search={search}
                level={level}
                status={status}
            />

            <QCMaterialsTable materials={materials} />

            <QCMaterialsPagination
                page={page}
                pageSize={pageSize}
                total={total}
            />
        </div>
    )
}

// Re-export QCMaterial type for convenience
export type { QCMaterial }
