import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    search: vi.fn(),
    upsertClient: vi.fn(),
    updateClient: vi.fn(),
}))

vi.mock('@/lib/vietnamese-address/client', () => ({
    searchVietnameseAddressClient: mocks.search,
}))

vi.mock('@/lib/api-client', () => ({
    upsertClientClient: mocks.upsertClient,
    updateClientClient: mocks.updateClient,
}))

import { ClientForm } from '../client-form'

function fillRequiredFields() {
    fireEvent.change(document.querySelector('#name')!, {
        target: { value: 'Nguyễn Văn A' },
    })
    fireEvent.change(document.querySelector('#id_card_num')!, {
        target: { value: '012345678901' },
    })
    fireEvent.change(document.querySelector('#date_of_birth')!, {
        target: { value: '1990-01-02' },
    })
    fireEvent.change(document.querySelector('#phone')!, {
        target: { value: '0912345678' },
    })
}

describe('ClientForm current address integration', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        mocks.upsertClient.mockResolvedValue({
            data: {
                id: '11111111-1111-4111-8111-111111111111',
                id_card_num: '012345678901',
                name: 'Nguyễn Văn A',
                date_of_birth: '1990-01-02',
                gender: 'Khác',
                phone: '0912345678',
                address: 'Phường Ba Đình, Thành phố Hà Nội',
                created_at: '2026-08-06T00:00:00.000Z',
                updated_at: '2026-08-06T00:00:00.000Z',
            },
        })
        mocks.search.mockResolvedValue({
            data: {
                dataset_version: '2026-07',
                suggestions: [{
                    code: '00001',
                    name: 'Ba Đình',
                    full_name: 'Phường Ba Đình',
                    kind: 'ward',
                    level: 'commune',
                    province_code: '01',
                    province_full_name: 'Thành phố Hà Nội',
                    formatted_address: 'Phường Ba Đình, Thành phố Hà Nội',
                }],
            },
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('persists a selected suggestion through the existing client mutation', async () => {
        render(
            <ClientForm
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )
        fillRequiredFields()

        const address = screen.getByPlaceholderText('Nhập địa chỉ liên hệ')
        fireEvent.change(address, { target: { value: 'Ba Dinh' } })
        await act(async () => {
            vi.advanceTimersByTime(350)
            await Promise.resolve()
        })
        fireEvent.click(screen.getByRole('option', {
            name: 'Phường Ba Đình, Thành phố Hà Nội',
        }))
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Lưu khách hàng' }))
            await Promise.resolve()
        })

        expect(mocks.upsertClient).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'Phường Ba Đình, Thành phố Hà Nội',
            }),
        )
    })

    it('refreshes a CCCD draft when the same identity is scanned again', () => {
        const props = {
            onSuccess: vi.fn(),
            onCancel: vi.fn(),
        }
        const { rerender } = render(
            <ClientForm
                {...props}
                initialData={{
                    name: 'Nguyễn Văn A',
                    id_card_num: '012345678901',
                    date_of_birth: '1990-01-02',
                    address: 'Hà Nội',
                }}
            />,
        )

        const address = screen.getByPlaceholderText('Nhập địa chỉ liên hệ')
        expect((address as HTMLInputElement).value).toBe('Hà Nội')

        rerender(
            <ClientForm
                {...props}
                initialData={{
                    name: 'Nguyễn Văn A',
                    id_card_num: '012345678901',
                    date_of_birth: '1990-01-02',
                    address: 'Đà Nẵng',
                }}
            />,
        )

        expect((address as HTMLInputElement).value).toBe('Đà Nẵng')
        expect(mocks.search).not.toHaveBeenCalled()
    })

    it('does not submit when Enter selects the active address suggestion', async () => {
        render(
            <ClientForm
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )
        fillRequiredFields()

        const address = screen.getByPlaceholderText('Nhập địa chỉ liên hệ')
        fireEvent.change(address, { target: { value: 'Ba Dinh' } })
        await act(async () => {
            vi.advanceTimersByTime(350)
            await Promise.resolve()
        })

        fireEvent.keyDown(address, { key: 'ArrowDown' })
        await act(async () => {
            fireEvent.keyDown(address, { key: 'Enter' })
            await Promise.resolve()
        })

        expect((address as HTMLInputElement).value).toBe(
            'Phường Ba Đình, Thành phố Hà Nội',
        )
        expect(mocks.upsertClient).not.toHaveBeenCalled()
    })
})
