import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

import { createUserClient, uploadSignatureClient } from '@/lib/api-client'
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
    beforeEach(() => {
        vi.clearAllMocks()
    })

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

    it('allows a manager to set confidential access and OTP email when creating an analyst', async () => {
        vi.mocked(createUserClient).mockResolvedValue({ success: true })

        render(
            <UserForm
                currentUserId="11111111-1111-4111-8111-111111111111"
                currentUserRole="manager"
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
            target: { value: 'analyst2' },
        })
        fireEvent.change(screen.getByLabelText('Họ và tên'), {
            target: { value: 'Analyst Two' },
        })
        fireEvent.change(screen.getByLabelText('Email'), {
            target: { value: 'analyst2@example.com' },
        })
        fireEvent.change(screen.getByLabelText('Mật khẩu'), {
            target: { value: 'password123' },
        })
        fireEvent.change(screen.getByLabelText('Email nhận OTP'), {
            target: { value: 'analyst-otp@example.com' },
        })
        fireEvent.click(screen.getByRole('checkbox', { name: 'Có quyền truy cập dữ liệu bí mật' }))
        fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

        await waitFor(() => {
            expect(createUserClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    role: 'analyst',
                    can_access_confidential: true,
                    otpEmail: 'analyst-otp@example.com',
                }),
            )
        })
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
        expect(screen.queryByText('Email nhận OTP')).toBeNull()
        expect(
            screen.getByText('Quyền truy cập dữ liệu bí mật chỉ do quản trị viên hệ thống cấu hình ngoài ứng dụng.'),
        ).toBeDefined()
    })

    it('shows analyst signature readiness and omits signature requirement for doctors', () => {
        const analystReady = buildUser({
            id: '33333333-3333-4333-8333-333333333333',
            username: 'analyst-ready',
            full_name: 'Analyst Ready',
            role: 'analyst',
            user_signatures: [{ is_active: true }],
        } as Partial<User>)
        const analystMissing = buildUser({
            id: '44444444-4444-4444-8444-444444444444',
            username: 'analyst-missing',
            full_name: 'Analyst Missing',
            role: 'analyst',
            user_signatures: [],
        } as Partial<User>)
        const doctor = buildUser({
            id: '55555555-5555-4555-8555-555555555555',
            username: 'doctor1',
            full_name: 'Doctor One',
            role: 'doctor',
        })

        render(
            <UserListTable
                users={[analystReady, analystMissing, doctor]}
                page={1}
                pageSize={10}
                totalPages={1}
                totalCount={3}
                currentUserId="11111111-1111-4111-8111-111111111111"
                currentUserRole="manager"
            />,
        )

        expect(screen.getByTitle('Analyst Ready đã có chữ ký điện tử')).toBeDefined()
        expect(screen.getByTitle('Analyst Missing chưa có chữ ký điện tử')).toBeDefined()
        expect(screen.queryByTitle('Doctor One chưa có chữ ký điện tử')).toBeNull()
    })

    it('guides analyst self-service signature upload during creation and does not upload on behalf', async () => {
        vi.mocked(createUserClient).mockResolvedValue({ success: true })
        const onSuccess = vi.fn()

        render(
            <UserForm
                currentUserId="11111111-1111-4111-8111-111111111111"
                currentUserRole="manager"
                onSuccess={onSuccess}
                onCancel={vi.fn()}
            />,
        )

        expect(
            screen.getByText(/Phân tích viên sẽ tự tải lên chữ ký điện tử trong Hồ sơ sau khi đăng nhập/i),
        ).toBeDefined()
        expect(screen.queryByText(/Chữ ký điện tử \(Tùy chọn\)/i)).toBeNull()

        fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'analyst1' } })
        fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Analyst One' } })
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'analyst1@example.com' } })
        fireEvent.change(screen.getByLabelText('Phòng Lab'), { target: { value: 'Lab A' } })
        fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Password123!' } })
        fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

        await waitFor(() => expect(createUserClient).toHaveBeenCalledTimes(1))
        expect(uploadSignatureClient).not.toHaveBeenCalled()
        expect(onSuccess).toHaveBeenCalledTimes(1)
    })
})
