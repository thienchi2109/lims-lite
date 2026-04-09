import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@/types'

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: vi.fn(),
        refresh: vi.fn(),
    }),
    usePathname: () => '/manager/users',
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/ui/search-input', () => ({
    SearchInput: () => <input aria-label="Tìm kiếm người dùng" />,
}))

vi.mock('@/components/user-dialog', () => ({
    UserDialog: () => null,
}))

vi.mock('@/lib/api-client', () => ({
    deleteUserClient: vi.fn(),
}))

import { UserListTable } from '../user-list-table'

describe('UserListTable role labels', () => {
    it('renders the doctor role label in Vietnamese', () => {
        const users: User[] = [
            {
                id: '11111111-1111-4111-8111-111111111111',
                username: 'doctor1',
                full_name: 'Doctor One',
                role: 'doctor',
                email: 'doctor@example.com',
                lab: 'Lab A',
                can_access_confidential: false,
                created_at: '2026-04-09T00:00:00.000Z',
                updated_at: '2026-04-09T00:00:00.000Z',
            },
        ]

        render(
            <UserListTable
                users={users}
                page={1}
                pageSize={10}
                totalPages={1}
                totalCount={1}
            />,
        )

        expect(screen.getByText('Bác sĩ')).toBeDefined()
    })
})
