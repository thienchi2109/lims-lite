import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/types'

const mockReplace = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: mockReplace,
        refresh: mockRefresh,
    }),
    usePathname: () => '/manager/users',
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/ui/search-input', () => ({
    SearchInput: () => <input aria-label="Tìm kiếm người dùng" />,
}))

vi.mock('@/components/user-dialog', () => ({
    UserDialog: ({
        open,
        mode,
        user,
    }: {
        open: boolean
        mode: 'create' | 'edit'
        user?: User
    }) => open && mode === 'edit'
        ? <div>Đang sửa {user?.username}</div>
        : null,
}))

vi.mock('@/components/manager-otp-email-dialog', () => ({
    ManagerOtpEmailDialog: ({
        open,
        user,
    }: {
        open: boolean
        user: User | null
    }) => open ? <div>Đang cấu hình OTP cho {user?.username}</div> : null,
}))

vi.mock('@/lib/api-client', () => ({
    deleteUserClient: vi.fn(),
}))

import { UserListTable } from '../user-list-table'

beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    }

    Object.defineProperties(Element.prototype, {
        hasPointerCapture: {
            configurable: true,
            value: () => false,
        },
        setPointerCapture: {
            configurable: true,
            value: () => undefined,
        },
        releasePointerCapture: {
            configurable: true,
            value: () => undefined,
        },
    })
})

const baseUser = {
    email: 'user@example.com',
    lab: 'Lab A',
    can_access_confidential: false,
    created_at: '2026-04-09T00:00:00.000Z',
    updated_at: '2026-04-09T00:00:00.000Z',
} satisfies Partial<User>

function buildUser(overrides: Partial<User> = {}): User {
    return {
        ...baseUser,
        id: '11111111-1111-4111-8111-111111111111',
        username: 'analyst1',
        full_name: 'Analyst One',
        role: 'analyst',
        ...overrides,
    } as User
}

function renderUserList(
    users: User[],
    overrides: Partial<{
        currentUserId: string
        currentUserRole: User['role']
    }> = {},
) {
    return render(
        <UserListTable
            users={users}
            page={1}
            pageSize={10}
            totalPages={1}
            totalCount={users.length}
            currentUserId={overrides.currentUserId}
            currentUserRole={overrides.currentUserRole ?? 'manager'}
        />,
    )
}

describe('UserListTable row actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps edit direct and moves analyst OTP and delete actions into the overflow menu', async () => {
        const user = userEvent.setup()
        const analyst = buildUser()

        renderUserList([analyst])

        expect(screen.getByRole('button', { name: 'Sửa người dùng analyst1' })).toBeDefined()
        const overflowTrigger = screen.getByRole('button', {
            name: 'Mở menu thao tác cho analyst1',
        })
        expect(overflowTrigger).toBeDefined()
        expect(overflowTrigger.closest('td')?.className).toContain('sticky')
        expect(overflowTrigger.closest('td')?.className).toContain('w-[104px]')
        const roleCell = overflowTrigger.closest('tr')?.querySelectorAll('td')[4]
        expect(roleCell?.className).not.toContain('sticky')
        expect(screen.queryByRole('button', {
            name: 'Cấu hình email OTP cho analyst1',
        })).toBeNull()
        expect(screen.queryByRole('button', {
            name: 'Xóa người dùng analyst1',
        })).toBeNull()

        await user.click(screen.getByRole('button', {
            name: 'Mở menu thao tác cho analyst1',
        }))

        const otpAction = screen.getByRole('menuitem', { name: 'Cấu hình email OTP' })
        expect(otpAction).toBeDefined()
        expect(screen.getByRole('menuitem', { name: 'Xóa người dùng' })).toBeDefined()

        await user.click(otpAction)

        expect(screen.getByText('Đang cấu hình OTP cho analyst1')).toBeDefined()
    })

    it('keeps delete but omits OTP when the role cannot configure it', async () => {
        const user = userEvent.setup()
        const doctor = buildUser({
            username: 'doctor1',
            full_name: 'Doctor One',
            role: 'doctor',
        })

        renderUserList([doctor])

        await user.click(screen.getByRole('button', {
            name: 'Mở menu thao tác cho doctor1',
        }))

        expect(screen.queryByRole('menuitem', { name: 'Cấu hình email OTP' })).toBeNull()
        expect(screen.getByRole('menuitem', { name: 'Xóa người dùng' })).toBeDefined()
    })

    it('keeps protected manager edit focusable and explains compact restrictions', async () => {
        const user = userEvent.setup()
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

        renderUserList([currentManager, otherManager], {
            currentUserId: currentManager.id,
        })

        expect(
            screen.queryByText('Bạn không thể chỉnh sửa hoặc xóa tài khoản quản lý khác.'),
        ).toBeNull()

        const editAction = screen.getByRole('button', { name: 'Sửa người dùng manager2' })
        expect(editAction.getAttribute('aria-disabled')).toBe('true')
        expect(editAction.hasAttribute('disabled')).toBe(false)

        await user.click(editAction)
        expect(screen.queryByText('Đang sửa manager2')).toBeNull()

        fireEvent.focus(editAction)
        expect((await screen.findByRole('tooltip')).textContent).toContain(
            'Không thể sửa tài khoản quản lý khác.',
        )

        await user.click(screen.getByRole('button', {
            name: 'Mở menu thao tác cho manager2',
        }))

        const deleteAction = screen.getByRole('menuitem', { name: 'Xóa người dùng' })
        expect(screen.getByRole('menuitem', { name: 'Cấu hình email OTP' })).toBeDefined()
        expect((deleteAction as HTMLDivElement).hasAttribute('data-disabled')).toBe(true)
        expect(screen.getByText('Tài khoản quản lý khác được bảo vệ.')).toBeDefined()
    })

    it('omits OTP configuration for the current manager row', async () => {
        const user = userEvent.setup()
        const currentManager = buildUser({
            id: '11111111-1111-4111-8111-111111111111',
            username: 'manager1',
            full_name: 'Manager One',
            role: 'manager',
        })

        renderUserList([currentManager], {
            currentUserId: currentManager.id,
        })

        await user.click(screen.getByRole('button', {
            name: 'Mở menu thao tác cho manager1',
        }))

        expect(screen.queryByRole('menuitem', { name: 'Cấu hình email OTP' })).toBeNull()
        expect(screen.getByRole('menuitem', { name: 'Xóa người dùng' })).toBeDefined()
    })
})
