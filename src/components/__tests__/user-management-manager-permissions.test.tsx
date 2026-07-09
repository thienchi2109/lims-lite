import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { User } from '@/types'
import { UserForm } from '../user-form'

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
    createUserClient: vi.fn(),
    deleteUserClient: vi.fn(),
    updateUserClient: vi.fn(),
    uploadSignatureClient: vi.fn(),
}))

import { UserListTable } from '../user-list-table'

beforeAll(() => {
    class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

const baseUser = {
    email: 'user@example.com',
    lab: 'Lab A',
    can_access_confidential: false,
    created_at: '2026-04-09T00:00:00.000Z',
    updated_at: '2026-04-09T00:00:00.000Z',
} satisfies Partial<User>

function buildUser(overrides: Partial<User>): User {
    return {
        ...baseUser,
        id: '11111111-1111-4111-8111-111111111111',
        username: 'user1',
        full_name: 'User One',
        role: 'analyst',
        ...overrides,
    } as User
}

describe('manager user-management UI permissions', () => {
    it('disables edit and delete actions for another manager row with Vietnamese copy', () => {
        const currentManager = buildUser({
            id: '11111111-1111-4111-8111-111111111111',
            username: 'manager1',
            full_name: 'Manager One',
            role: 'manager',
        })
        const otherManager = buildUser({
            id: '22222222-2222-4222-8222-222222222222',
            username: 'manager2',
            full_name: 'Manager Two',
            role: 'manager',
        })

        render(
            <UserListTable
                users={[currentManager, otherManager]}
                page={1}
                pageSize={10}
                totalPages={1}
                totalCount={2}
                currentUserId={currentManager.id}
                currentUserRole="manager"
            />,
        )

        expect(
            screen.getByText('Bạn không thể chỉnh sửa hoặc xóa tài khoản quản lý khác.'),
        ).toBeDefined()
        expect(screen.getByRole('button', { name: 'Sửa người dùng manager2' }).hasAttribute('disabled')).toBe(true)
        expect(screen.getByRole('button', { name: 'Xóa người dùng manager2' }).hasAttribute('disabled')).toBe(true)
    })

    it('omits confidential-access control when a manager creates a user', () => {
        render(
            <UserForm
                currentUserId="11111111-1111-4111-8111-111111111111"
                currentUserRole="manager"
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        expect(screen.queryByText('Có quyền truy cập dữ liệu bí mật')).toBeNull()
        expect(
            screen.getByText('Quyền truy cập dữ liệu bí mật chỉ do quản trị viên hệ thống cấu hình ngoài ứng dụng.'),
        ).toBeDefined()
    })

    it('omits confidential-access control when a manager edits their own account', () => {
        const manager = buildUser({
            id: '11111111-1111-4111-8111-111111111111',
            username: 'manager1',
            full_name: 'Manager One',
            role: 'manager',
            can_access_confidential: true,
        })

        render(
            <UserForm
                user={manager}
                currentUserId={manager.id}
                currentUserRole="manager"
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        expect(screen.queryByText('Có quyền truy cập dữ liệu bí mật')).toBeNull()
        expect(
            screen.getByText('Quyền truy cập dữ liệu bí mật chỉ do quản trị viên hệ thống cấu hình ngoài ứng dụng.'),
        ).toBeDefined()
    })
})
