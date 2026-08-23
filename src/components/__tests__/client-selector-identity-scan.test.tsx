import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, vi } from 'vitest'
import type { CreateClient } from '@/types'

const mocks = vi.hoisted(() => ({
    findClientByIdentityQrClient: vi.fn(async () => ({ data: null })),
    prepareManualAccessionClientClient: vi.fn(),
    prepareQrAccessionClientClient: vi.fn(),
}))

vi.mock('@/components/client-form', () => ({
    ClientForm: ({
        initialData,
        prepareClient,
        onPending,
    }: {
        initialData?: Partial<CreateClient>
        prepareClient?: (data: CreateClient) => Promise<{
            data?: unknown
            error?: string
        }>
        onPending?: (pending: unknown) => void
    }) => (
        <div>
            <dl data-testid="client-form">
                <dt>Họ tên</dt>
                <dd>{initialData?.name}</dd>
                <dt>Số CCCD</dt>
                <dd>{initialData?.id_card_num}</dd>
                <dt>Ngày sinh</dt>
                <dd>{initialData?.date_of_birth}</dd>
                <dt>Địa chỉ</dt>
                <dd>{initialData?.address}</dd>
            </dl>
            <button
                type="button"
                onClick={() => void prepareClient?.({
                    id_card_num: initialData?.id_card_num || '086094006827',
                    name: initialData?.name || 'Nguyễn Văn A',
                    date_of_birth: initialData?.date_of_birth || '1994-09-21',
                    gender: initialData?.gender || 'Nam',
                    phone: '0901234567',
                    address: initialData?.address || 'Cần Thơ',
                }).then((result) => {
                    if (result.data) onPending?.(result.data)
                })}
            >
                Lưu khách hàng mock
            </button>
        </div>
    ),
}))

vi.mock('@/components/client-qr-scanner-dialog', () => ({
    ClientQrScannerDialog: ({
        open,
        onScan,
    }: {
        open: boolean
        onScan: (decodedText: string) => void | Promise<void>
    }) => open ? (
        <button
            type="button"
            onClick={() => void onScan(
                '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|Cần Thơ|10052021',
            )}
        >
            Quét CCCD mẫu
        </button>
    ) : null,
}))

vi.mock('@/lib/api-client', () => ({
    fetchClientsClient: vi.fn(async () => ({ data: [] })),
    findClientByIdentityQrClient: mocks.findClientByIdentityQrClient,
    prepareManualAccessionClientClient:
        mocks.prepareManualAccessionClientClient,
    prepareQrAccessionClientClient: mocks.prepareQrAccessionClientClient,
}))

import { ClientSelector } from '../client-selector'

describe('ClientSelector identity scan', () => {
    beforeEach(() => {
        mocks.findClientByIdentityQrClient.mockReset()
        mocks.findClientByIdentityQrClient.mockResolvedValue({ data: null })
        mocks.prepareManualAccessionClientClient.mockReset()
        mocks.prepareQrAccessionClientClient.mockReset()
    })

    it('fills the client draft from a scanned CCCD QR payload', async () => {
        const user = userEvent.setup()
        const onSelect = vi.fn()

        render(<ClientSelector selectedClient={null} onSelect={onSelect} />)

        await user.click(screen.getByTitle('Quét mã QR'))
        await user.click(screen.getByRole('button', { name: 'Quét CCCD mẫu' }))

        await waitFor(() => {
            expect(screen.getByTestId('client-form')).not.toBeNull()
        })
        expect(screen.getByText('Nguyễn Thiện Chí')).not.toBeNull()
        expect(screen.getByText('086094006827')).not.toBeNull()
        expect(screen.getByText('1994-09-21')).not.toBeNull()
        expect(screen.getByText('Cần Thơ')).not.toBeNull()
        expect(onSelect).toHaveBeenCalledWith(null)
        expect(mocks.findClientByIdentityQrClient).toHaveBeenCalledWith({
            governmentIdentityValue: '086094006827',
            name: 'Nguyễn Thiện Chí',
            dateOfBirth: '1994-09-21',
        })
    })

    it('does not publish a QR draft when lookup is unresolved', async () => {
        mocks.findClientByIdentityQrClient.mockRejectedValueOnce(
            new Error('Xung đột thông tin'),
        )
        const user = userEvent.setup()
        const onSelect = vi.fn()

        render(<ClientSelector selectedClient={null} onSelect={onSelect} />)

        await user.click(screen.getByTitle('Quét mã QR'))
        await user.click(screen.getByRole('button', { name: 'Quét CCCD mẫu' }))

        await waitFor(() => {
            expect(mocks.findClientByIdentityQrClient).toHaveBeenCalledTimes(1)
        })
        expect(screen.queryByTestId('client-form')).toBeNull()
        expect(onSelect).not.toHaveBeenCalled()
    })

    it('prepares a manual client as a draft selection without raw upsert', async () => {
        const pending = {
            kind: 'pending' as const,
            workflow: 'manual' as const,
            client: {
                id_card_num: '086094006827',
                name: 'Nguyễn Văn A',
                date_of_birth: '1994-09-21',
                gender: 'Nam' as const,
                phone: '0901234567',
                address: 'Cần Thơ',
            },
        }
        mocks.prepareManualAccessionClientClient.mockResolvedValueOnce({
            data: pending,
        })
        const user = userEvent.setup()
        const onSelect = vi.fn()

        render(<ClientSelector selectedClient={null} onSelect={onSelect} />)

        await user.click(screen.getByRole('button', { name: 'Tạo khách hàng mới' }))
        await user.click(screen.getByRole('button', { name: 'Lưu khách hàng mock' }))

        await waitFor(() => {
            expect(mocks.prepareManualAccessionClientClient).toHaveBeenCalledTimes(1)
        })
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'draft',
                workflow: 'manual',
                resolution: expect.objectContaining({
                    kind: 'draft',
                    name: 'Nguyễn Văn A',
                }),
            }),
        )
    })

    it('keeps QR ownership through pending client preparation', async () => {
        const pending = {
            kind: 'pending' as const,
            workflow: 'qr' as const,
            client: {
                id_card_num: '086094006827',
                name: 'Nguyễn Thiện Chí',
                date_of_birth: '1994-09-21',
                gender: 'Nam' as const,
                phone: '0901234567',
                address: 'Cần Thơ',
            },
        }
        mocks.prepareQrAccessionClientClient.mockResolvedValueOnce({
            data: pending,
        })
        const user = userEvent.setup()
        const onSelect = vi.fn()

        render(<ClientSelector selectedClient={null} onSelect={onSelect} />)

        await user.click(screen.getByTitle('Quét mã QR'))
        await user.click(screen.getByRole('button', { name: 'Quét CCCD mẫu' }))
        await user.click(screen.getByRole('button', { name: 'Lưu khách hàng mock' }))

        await waitFor(() => {
            expect(mocks.prepareQrAccessionClientClient).toHaveBeenCalledTimes(1)
        })
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'draft',
                workflow: 'qr',
            }),
        )
    })
})
