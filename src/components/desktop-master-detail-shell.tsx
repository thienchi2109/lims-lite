import type { ReactNode } from 'react'

interface DesktopMasterDetailShellProps {
    workspaceTestId: string
    gridColumnTestId: string
    inspectorColumnTestId: string
    left: ReactNode
    right: ReactNode
    gridColumnClassName?: string
    inspectorClassName?: string
    inspectorId?: string
}

export function DesktopMasterDetailShell({
    workspaceTestId,
    gridColumnTestId,
    inspectorColumnTestId,
    left,
    right,
    gridColumnClassName,
    inspectorClassName,
    inspectorId,
}: DesktopMasterDetailShellProps) {
    return (
        <div
            data-testid={workspaceTestId}
            className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1.86fr)_minmax(22rem,1fr)]"
        >
            <section
                data-testid={gridColumnTestId}
                className={`flex min-h-0 flex-col ${gridColumnClassName ?? ''}`}
            >
                {left}
            </section>

            <aside
                id={inspectorId}
                data-testid={inspectorColumnTestId}
                className={`min-h-0 ${inspectorClassName ?? ''}`}
            >
                {right}
            </aside>
        </div>
    )
}
