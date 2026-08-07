import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

vi.mock('@/components/client-form', () => ({
    ClientForm: () => <div data-testid="client-form">Khách hàng mới</div>,
}))

vi.mock('@/components/client-qr-scanner-dialog', () => ({
    ClientQrScannerDialog: () => null,
}))

vi.mock('@/hooks/use-client-identity-scan', () => ({
    useClientIdentityScan: () => ({
        handleIdentityScan: vi.fn(),
        invalidateIdentityScan: vi.fn(),
    }),
}))

vi.mock('@/lib/api-client', () => ({
    fetchClientsClient: vi.fn(async () => ({ data: [] })),
}))

import { ClientSelector } from '../client-selector'

describe('ClientSelector submit safety', () => {
    it('opens the client form without submitting the parent accession form', async () => {
        const user = userEvent.setup()
        const handleSubmit = vi.fn((event: React.FormEvent) => {
            event.preventDefault()
        })

        render(
            <form onSubmit={handleSubmit}>
                <ClientSelector selectedClient={null} onSelect={vi.fn()} />
            </form>,
        )

        const createButton = screen.getByRole('button', {
            name: 'Tạo khách hàng mới',
        })

        expect(createButton.getAttribute('type')).toBe('button')
        await user.click(createButton)

        expect(handleSubmit).not.toHaveBeenCalled()
        expect(screen.queryByTestId('client-form')).not.toBeNull()
    })
})
