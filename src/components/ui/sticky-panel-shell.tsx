import type { ReactNode } from 'react'

interface StickyPanelShellProps {
    header: ReactNode
    children: ReactNode
    bodyClassName?: string
}

export function StickyPanelShell({
    header,
    children,
    bodyClassName,
}: StickyPanelShellProps) {
    return (
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="text-sm font-semibold text-slate-900">{header}</div>
            </div>

            <div className={`flex-1 min-h-0 overflow-auto ${bodyClassName ?? ''}`}>
                {children}
            </div>
        </section>
    )
}
