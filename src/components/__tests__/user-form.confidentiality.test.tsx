import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: ({
        checked,
        onCheckedChange,
        ...props
    }: {
        checked?: boolean
        onCheckedChange?: (checked: boolean) => void
        [key: string]: unknown
    }) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
            {...props}
        />
    ),
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

    it('shows a confidential access toggle for managers and submits it', async () => {
        render(
            <UserForm
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
            target: { value: 'manager1' },
        })
        fireEvent.change(screen.getByLabelText('Họ và tên'), {
            target: { value: 'Manager One' },
        })
        fireEvent.change(screen.getByLabelText('Email'), {
            target: { value: 'manager@example.com' },
        })
        fireEvent.change(screen.getByLabelText('Mật khẩu'), {
            target: { value: 'password123' },
        })

        fireEvent.click(screen.getByRole('checkbox', { name: 'Có quyền truy cập dữ liệu bí mật' }))
        fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

        await waitFor(() => {
            expect(mocks.createUserClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: 'manager1',
                    full_name: 'Manager One',
                    email: 'manager@example.com',
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
})
