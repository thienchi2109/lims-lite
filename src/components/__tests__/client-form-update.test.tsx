import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client, CreateClient } from '@/types'

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

const CLIENT_ID = '22222222-2222-4222-8222-222222222222'

const INITIAL_DATA: CreateClient = {
    id_card_num: '086094006827',
    name: 'Nguyễn Văn A',
    date_of_birth: '1994-09-21',
    gender: 'Nữ',
    phone: '0912345678',
    address: 'Cần Thơ',
    health_insurance_num: 'DN401010000001',
    expiry_date: '2027-12-31',
}

const CLIENT: Client = {
    id: CLIENT_ID,
    ...INITIAL_DATA,
    created_at: '2026-08-22T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
}

describe('ClientForm update mode', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.updateClient.mockResolvedValue({
            data: CLIENT,
        })
    })

    it.each([
        ['Họ và tên', /Họ và tên/, INITIAL_DATA.name],
        ['Số CMND/CCCD', /Số CMND\/CCCD/, INITIAL_DATA.id_card_num],
        ['Ngày sinh', /Ngày sinh/, INITIAL_DATA.date_of_birth],
    ])('renders %s with its initial value as read-only and enabled', (
        _name,
        label,
        initialValue,
    ) => {
        render(
            <ClientForm
                mode="update"
                clientId={CLIENT_ID}
                initialData={INITIAL_DATA}
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        const control = screen.getByLabelText(label) as HTMLInputElement

        expect(control.type).not.toBe('hidden')
        expect(control.hidden).toBe(false)
        expect(control.closest('[hidden]')).toBeNull()
        expect(control.value).toBe(initialValue)
        expect(control.readOnly).toBe(true)
        expect(control.disabled).toBe(false)
    })

    it('submits one edited profile-only update from full client initialData', async () => {
        render(
            <ClientForm
                mode="update"
                clientId={CLIENT_ID}
                initialData={INITIAL_DATA}
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        const phone = screen.getByLabelText(/Số điện thoại/) as HTMLInputElement
        fireEvent.change(phone, {
            target: { value: '0987654321' },
        })
        expect(phone.value).toBe('0987654321')

        fireEvent.click(screen.getByRole('button', {
            name: 'Lưu khách hàng',
        }))

        await waitFor(() => {
            expect(mocks.updateClient).toHaveBeenCalledTimes(1)
            expect(mocks.updateClient).toHaveBeenCalledWith(CLIENT_ID, {
                gender: 'Nữ',
                phone: '0987654321',
                address: 'Cần Thơ',
                health_insurance_num: 'DN401010000001',
                expiry_date: '2027-12-31',
            })
        })
        expect(mocks.upsertClient).not.toHaveBeenCalled()
    })
})
