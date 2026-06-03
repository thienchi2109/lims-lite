import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    useQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: (options: unknown) => mocks.useQuery(options),
}))

vi.mock('@/lib/api-client', () => ({
    getClientClient: vi.fn(),
}))

import { useClient } from './use-client'

describe('useClient', () => {
    it('forwards embedded client details as placeholder data', () => {
        const placeholderData = {
            id: 'client-1',
            name: 'Khach hang A',
            id_card_num: '079123456789',
            date_of_birth: '1990-01-01',
            gender: 'Nam',
            phone: '0901234567',
            address: '123 Duong ABC',
            health_insurance_num: 'BHYT-123',
            expiry_date: '2026-12-31',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        }

        useClient({ clientId: 'client-1', placeholderData })

        const options = mocks.useQuery.mock.calls[0]?.[0] as Record<string, unknown>
        expect(options.placeholderData).toBe(placeholderData)
        expect(options).not.toHaveProperty('initialData')
    })
})
