import { fireEvent, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ScannerContext } from '@/components/scanner/use-scanner'

const searchMocks = vi.hoisted(() => ({
    routerPush: vi.fn(),
    useGlobalSearch: vi.fn(),
}))

vi.mock('next/image', () => ({
    default: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: searchMocks.routerPush }),
}))

vi.mock('@/hooks/use-search', () => ({
    useGlobalSearch: (options: unknown) => searchMocks.useGlobalSearch(options),
}))

vi.mock('@/components/dashboard-nav', () => ({
    DashboardNav: () => <div />,
}))

vi.mock('@/components/user-profile-dropdown', () => ({
    UserProfileDropdown: () => <div />,
}))

vi.mock('@/components/scanner/scanner-connection-button', () => ({
    ScannerConnectionButton: () => <div />,
}))

vi.mock('@/components/ui/button', () => ({
    Button: ({
        children,
        className,
        ...props
    }: ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button className={className} {...props}>
            {children}
        </button>
    ),
}))

vi.mock('@/components/ui/command', () => ({
    CommandDialog: ({
        children,
        onOpenChange,
        open,
    }: {
        children?: ReactNode
        onOpenChange: (open: boolean) => void
        open: boolean
    }) => open ? (
        <div role="dialog">
            {children}
            <button type="button" onClick={() => onOpenChange(false)}>
                Close
            </button>
        </div>
    ) : null,
    CommandInput: ({
        onValueChange,
        placeholder,
        value,
    }: {
        onValueChange: (value: string) => void
        placeholder?: string
        value?: string
    }) => (
        <input
            placeholder={placeholder}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
        />
    ),
    CommandList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    CommandEmpty: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    CommandGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    CommandSeparator: () => <hr />,
}))

vi.mock('@/components/search-result-item', () => ({
    SearchResultItem: () => null,
}))

import { DashboardHeader } from '../dashboard-header'

describe('DashboardHeader global search shortcut ownership', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        searchMocks.useGlobalSearch.mockReturnValue({
            data: [],
            isLoading: false,
        })
    })

    it('mounts three search triggers but opens one dialog per Ctrl/Meta shortcut', () => {
        render(
            <ScannerContext.Provider
                value={{
                    state: 'disconnected',
                    error: null,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                    registerConsumer: vi.fn(() => () => undefined),
                }}
            >
                <DashboardHeader
                    subtitle="Quản lý mẫu"
                    user={{
                        full_name: 'Manager A',
                        role: 'manager',
                    }}
                />
            </ScannerContext.Provider>,
        )

        expect(
            screen.getAllByRole('button', { name: /Tìm kiếm/ }),
        ).toHaveLength(3)

        fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
        expect(screen.getAllByRole('dialog')).toHaveLength(1)

        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(screen.queryAllByRole('dialog')).toHaveLength(0)

        fireEvent.keyDown(document, { key: 'k', metaKey: true })
        expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })
})
