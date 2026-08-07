import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { CreateClient } from '@/types'

const mocks = vi.hoisted(() => ({
    findClientByIdentityClient: vi.fn(async () => ({ data: null })),
}))

vi.mock('@/components/client-form', () => ({
    ClientForm: ({ initialData }: { initialData?: Partial<CreateClient> }) => (
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
    findClientByIdentityClient: mocks.findClientByIdentityClient,
}))

import { ClientSelector } from '../client-selector'

describe('ClientSelector identity scan', () => {
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
        expect(mocks.findClientByIdentityClient).toHaveBeenCalledWith(
            'Nguyễn Thiện Chí',
            '1994-09-21',
        )
    })
})
