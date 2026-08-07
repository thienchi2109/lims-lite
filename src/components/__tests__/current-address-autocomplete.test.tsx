import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    search: vi.fn(),
}))

vi.mock('@/lib/vietnamese-address/client', () => ({
    searchVietnameseAddressClient: mocks.search,
}))

import { CurrentAddressAutocomplete } from '../current-address-autocomplete'

type SearchResponse = {
    data?: {
        dataset_version: string
        suggestions: Array<{
            code: string
            name: string
            full_name: string
            kind: string
            level: 'province' | 'commune'
            province_code?: string
            province_full_name?: string
            formatted_address: string
        }>
    }
    error?: string
    unavailable?: boolean
    disabled?: boolean
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((resolver) => {
        resolve = resolver
    })
    return { promise, resolve }
}

function Harness({ initialValue = '' }: { initialValue?: string }) {
    const [value, setValue] = useState(initialValue)

    return (
        <div>
            <CurrentAddressAutocomplete
                id="address"
                value={value}
                onChange={setValue}
                placeholder="Nhập địa chỉ liên hệ"
            />
            <button
                type="button"
                onClick={() => setValue('Địa chỉ mới từ CCCD')}
            >
                Áp dụng CCCD
            </button>
        </div>
    )
}

const hanoiSuggestion = {
    code: '00001',
    name: 'Ba Đình',
    full_name: 'Phường Ba Đình',
    kind: 'ward',
    level: 'commune' as const,
    province_code: '01',
    province_full_name: 'Thành phố Hà Nội',
    formatted_address: 'Phường Ba Đình, Thành phố Hà Nội',
}

async function flushDebounce() {
    await act(async () => {
        vi.advanceTimersByTime(350)
        await Promise.resolve()
    })
}

describe('CurrentAddressAutocomplete', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mocks.search.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('formats a selected commune and province into the controlled address', async () => {
        mocks.search.mockResolvedValue({
            data: {
                dataset_version: '2026-07',
                suggestions: [hanoiSuggestion],
            },
        } satisfies SearchResponse)
        render(<Harness />)

        const input = screen.getByPlaceholderText('Nhập địa chỉ liên hệ')
        fireEvent.change(input, { target: { value: 'Ba Dinh' } })
        await flushDebounce()

        fireEvent.click(screen.getByRole('option', {
            name: 'Phường Ba Đình, Thành phố Hà Nội',
        }))

        expect((input as HTMLInputElement).value).toBe(
            'Phường Ba Đình, Thành phố Hà Nội',
        )
    })

    it('keeps manual entry usable when lookup fails or contains a full address', async () => {
        mocks.search.mockResolvedValue({ error: 'Không khả dụng' } satisfies SearchResponse)
        render(<Harness />)

        const input = screen.getByPlaceholderText('Nhập địa chỉ liên hệ')
        fireEvent.change(input, { target: { value: 'Ba Dinh' } })
        await flushDebounce()

        expect((input as HTMLInputElement).value).toBe('Ba Dinh')

        fireEvent.change(input, {
            target: { value: '12 Nguyễn Trãi, Hà Nội' },
        })
        await flushDebounce()

        expect((input as HTMLInputElement).value).toBe('12 Nguyễn Trãi, Hà Nội')
        expect(mocks.search).toHaveBeenCalledTimes(1)
    })

    it('retries after a transient service failure', async () => {
        mocks.search
            .mockResolvedValueOnce({
                error: 'Tạm thời không khả dụng',
                unavailable: true,
            })
            .mockResolvedValueOnce({
                data: {
                    dataset_version: '2026-07',
                    suggestions: [hanoiSuggestion],
                },
            })
        render(<Harness />)

        const input = screen.getByPlaceholderText('Nhập địa chỉ liên hệ')
        fireEvent.change(input, { target: { value: 'Ha Noi' } })
        await flushDebounce()
        fireEvent.change(input, { target: { value: 'Ba Dinh' } })
        await flushDebounce()

        expect(mocks.search).toHaveBeenCalledTimes(2)
        expect(screen.getByRole('option', {
            name: 'Phường Ba Đình, Thành phố Hà Nội',
        })).toBeDefined()
    })

    it('preserves the supplied blur callback', () => {
        const onBlur = vi.fn()

        render(
            <CurrentAddressAutocomplete
                id="address"
                value=""
                onChange={vi.fn()}
                onBlur={onBlur}
            />,
        )

        fireEvent.blur(screen.getByRole('combobox'))

        expect(onBlur).toHaveBeenCalledTimes(1)
    })

    it('ignores stale responses after a newer scan owns the address', async () => {
        const pending = deferred<SearchResponse>()
        mocks.search.mockReturnValue(pending.promise)
        render(<Harness />)

        const input = screen.getByPlaceholderText('Nhập địa chỉ liên hệ')
        fireEvent.change(input, { target: { value: 'Ba Dinh' } })
        await flushDebounce()
        fireEvent.click(screen.getByRole('button', { name: 'Áp dụng CCCD' }))

        await act(async () => {
            pending.resolve({
                data: {
                    dataset_version: '2026-07',
                    suggestions: [hanoiSuggestion],
                },
            })
            await pending.promise
        })

        expect((input as HTMLInputElement).value).toBe('Địa chỉ mới từ CCCD')
        expect(screen.queryByRole('option')).toBeNull()
    })

    it('shows only the newest response when the user types rapidly', async () => {
        const first = deferred<SearchResponse>()
        const second = deferred<SearchResponse>()
        mocks.search
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise)
        render(<Harness />)

        const input = screen.getByPlaceholderText('Nhập địa chỉ liên hệ')
        fireEvent.change(input, { target: { value: 'Ha Noi' } })
        await flushDebounce()
        fireEvent.change(input, { target: { value: 'Da Nang' } })
        await flushDebounce()

        await act(async () => {
            second.resolve({
                data: {
                    dataset_version: '2026-07',
                    suggestions: [{
                        ...hanoiSuggestion,
                        code: '00002',
                        name: 'Hải Châu',
                        full_name: 'Phường Hải Châu',
                        province_code: '48',
                        province_full_name: 'Thành phố Đà Nẵng',
                        formatted_address: 'Phường Hải Châu, Thành phố Đà Nẵng',
                    }],
                },
            })
            await second.promise
        })
        await act(async () => {
            first.resolve({
                data: {
                    dataset_version: '2026-07',
                    suggestions: [hanoiSuggestion],
                },
            })
            await first.promise
        })

        expect(screen.getByRole('option', {
            name: 'Phường Hải Châu, Thành phố Đà Nẵng',
        })).toBeDefined()
        expect(screen.queryByRole('option', {
            name: 'Phường Ba Đình, Thành phố Hà Nội',
        })).toBeNull()
    })
})
