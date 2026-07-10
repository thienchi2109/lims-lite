import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/types'

const mocks = vi.hoisted(() => ({
    createUserClient: vi.fn(),
    updateUserClient: vi.fn(),
    uploadSignatureClient: vi.fn(),
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}))

vi.mock('@/lib/api-client', () => ({
    createUserClient: (...args: unknown[]) => mocks.createUserClient(...args),
    updateUserClient: (...args: unknown[]) => mocks.updateUserClient(...args),
    uploadSignatureClient: (...args: unknown[]) => mocks.uploadSignatureClient(...args),
}))

vi.mock('sonner', () => ({
    toast: mocks.toast,
}))

vi.mock('@/components/signature-upload-field', () => ({
    SignatureUploadField: () => null,
}))

vi.mock('@/components/ui/select', () => ({
    Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ''}</span>,
}))

import { UserForm } from '../user-form'

describe('UserForm confidentiality access', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.createUserClient.mockResolvedValue({ success: true })
        mocks.updateUserClient.mockResolvedValue({ success: true })
        mocks.uploadSignatureClient.mockResolvedValue({ success: true })
    })

    it('renders a Vietnamese keyboard-accessible confidential access switch and submits it', async () => {
        render(
            <UserForm
                currentUserRole="manager"
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
            target: { value: 'analyst1' },
        })
        fireEvent.change(screen.getByLabelText('Họ và tên'), {
            target: { value: 'Analyst One' },
        })
        fireEvent.change(screen.getByLabelText('Email'), {
            target: { value: 'analyst@example.com' },
        })
        fireEvent.change(screen.getByLabelText('Mật khẩu'), {
            target: { value: 'password123' },
        })

        const confidentialAccess = screen.getByRole('switch', {
            name: 'Có quyền truy cập dữ liệu bí mật',
        })
        expect(confidentialAccess.getAttribute('aria-checked')).toBe('false')

        fireEvent.keyDown(confidentialAccess, { key: ' ' })
        expect(confidentialAccess.getAttribute('aria-checked')).toBe('true')

        fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

        await waitFor(() => {
            expect(mocks.createUserClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: 'analyst1',
                    full_name: 'Analyst One',
                    email: 'analyst@example.com',
                    password: 'password123',
                    can_access_confidential: true,
                }),
            )
        })
    })

    it('offers the doctor role in the user role selector', () => {
        render(
            <UserForm
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        expect(screen.getByText('Bác sĩ')).toBeDefined()
    })

    it('shows role as read-only during edit and omits it from the update payload', async () => {
        const analyst = {
            id: '11111111-1111-4111-8111-111111111111',
            username: 'analyst1',
            full_name: 'Analyst One',
            email: 'analyst@example.com',
            lab: 'Central Lab',
            role: 'analyst',
            can_access_confidential: false,
            created_at: '2026-07-10T00:00:00.000Z',
            updated_at: '2026-07-10T00:00:00.000Z',
        } as User

        render(
            <UserForm
                user={analyst}
                currentUserId="22222222-2222-4222-8222-222222222222"
                currentUserRole="manager"
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        const roleField = screen.getByRole('textbox', { name: 'Vai trò' })
        expect((roleField as HTMLInputElement).value).toBe('Kỹ thuật viên')
        expect(roleField.hasAttribute('readonly')).toBe(true)
        expect(screen.queryByText('Chọn vai trò')).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

        await waitFor(() => {
            expect(mocks.updateUserClient).toHaveBeenCalledTimes(1)
        })

        expect(mocks.updateUserClient.mock.calls[0][0]).not.toHaveProperty('role')
    })
})
