import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    ScannerContext,
    useScannerConsumer,
} from '@/components/scanner/use-scanner'
import { createScannerDispatcher } from '@/lib/scanner/scanner-dispatcher'

const searchMocks = vi.hoisted(() => ({
    sampleSearch: vi.fn(),
    useGlobalSearch: vi.fn(),
    routerPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: searchMocks.routerPush }),
}))

vi.mock('@/hooks/use-search', () => ({
    useGlobalSearch: (options: unknown) => searchMocks.useGlobalSearch(options),
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

import { GlobalSearch } from '../global-search'

function SamplesSearchProbe() {
    useScannerConsumer({
        enabled: true,
        kinds: ['sample-code'],
        priority: 100,
        onEvent: (event) => {
            if (event.kind !== 'sample-code') return
            searchMocks.sampleSearch(event.code)
        },
    })
    return null
}

describe('GlobalSearch serial search', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        searchMocks.useGlobalSearch.mockReturnValue({
            data: [],
            isLoading: false,
        })
    })

    afterEach(() => {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
    })

    it('renders an accessible fixed-size compact trigger', () => {
        render(
            <ScannerContext.Provider
                value={{
                    state: 'connected',
                    error: null,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                    registerConsumer: vi.fn(() => () => undefined),
                }}
            >
                <GlobalSearch variant="compact" skipShortcut />
            </ScannerContext.Provider>,
        )

        const trigger = screen.getByRole('button', { name: 'Tìm kiếm' })
        expect(trigger.classList.contains('h-10')).toBe(true)
        expect(trigger.classList.contains('w-10')).toBe(true)
        expect(trigger.classList.contains('shrink-0')).toBe(true)
    })

    it('wins only while open and updates one dialog immediately without navigation', () => {
        const dispatcher = createScannerDispatcher()
        const registerConsumer = vi.fn(dispatcher.registerConsumer)
        render(
            <ScannerContext.Provider
                value={{
                    state: 'connected',
                    error: null,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                    registerConsumer,
                }}
            >
                <SamplesSearchProbe />
                <GlobalSearch skipShortcut variant="full" />
                <GlobalSearch skipShortcut variant="full" />
            </ScannerContext.Provider>,
        )

        expect(registerConsumer).toHaveBeenCalledTimes(1)
        act(() => {
            dispatcher.dispatch({
                kind: 'sample-code',
                code: 'CDC-XN-22072026-0001',
            })
        })
        expect(searchMocks.sampleSearch).toHaveBeenCalledWith(
            'CDC-XN-22072026-0001',
        )

        const triggers = screen.getAllByRole('button', { name: /Tìm kiếm/ })
        fireEvent.click(triggers[1])

        expect(registerConsumer).toHaveBeenCalledTimes(2)
        expect(registerConsumer).toHaveBeenLastCalledWith(
            expect.objectContaining({
                kinds: ['sample-code'],
                priority: 200,
            }),
        )

        act(() => {
            dispatcher.dispatch({
                kind: 'sample-code',
                code: 'CDC-XN-22072026-0002',
            })
        })

        expect(
            screen.getByPlaceholderText('Tìm kiếm mẫu, khách hàng, chỉ tiêu...'),
        ).toHaveProperty('value', 'CDC-XN-22072026-0002')
        expect(searchMocks.useGlobalSearch).toHaveBeenCalledWith(
            expect.objectContaining({
                query: 'CDC-XN-22072026-0002',
                enabled: true,
            }),
        )
        expect(searchMocks.sampleSearch).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('dialog')).toBeDefined()
        expect(searchMocks.routerPush).not.toHaveBeenCalled()

        const immediateSearchTransitions = searchMocks.useGlobalSearch.mock.calls.filter(
            ([options]) =>
                (options as { query: string }).query === 'CDC-XN-22072026-0002',
        ).length
        act(() => {
            vi.advanceTimersByTime(300)
        })
        expect(
            searchMocks.useGlobalSearch.mock.calls.filter(
                ([options]) =>
                    (options as { query: string }).query === 'CDC-XN-22072026-0002',
            ),
        ).toHaveLength(immediateSearchTransitions)

        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        act(() => {
            dispatcher.dispatch({
                kind: 'sample-code',
                code: 'CDC-XN-22072026-0003',
            })
        })
        expect(searchMocks.sampleSearch).toHaveBeenLastCalledWith(
            'CDC-XN-22072026-0003',
        )

        fireEvent.click(triggers[0])
        expect(
            screen.getByPlaceholderText('Tìm kiếm mẫu, khách hàng, chỉ tiêu...'),
        ).toHaveProperty('value', '')

        act(() => {
            dispatcher.dispatch({
                kind: 'sample-code',
                code: 'CDC-XN-22072026-0004',
            })
        })
        expect(
            screen.getByPlaceholderText('Tìm kiếm mẫu, khách hàng, chỉ tiêu...'),
        ).toHaveProperty('value', 'CDC-XN-22072026-0004')
        expect(searchMocks.routerPush).not.toHaveBeenCalled()
    })
})
