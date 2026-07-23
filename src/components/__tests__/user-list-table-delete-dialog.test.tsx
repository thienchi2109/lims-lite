import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/types'

const mocks = vi.hoisted(() => ({
    deleteUser: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: mocks.replace,
        refresh: mocks.refresh,
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

vi.mock('@/components/manager-otp-email-dialog', () => ({
    ManagerOtpEmailDialog: () => null,
}))

vi.mock('@/lib/api-client', () => ({
    deleteUserClient: mocks.deleteUser,
}))

vi.mock('sonner', () => ({
    toast: {
        success: mocks.toastSuccess,
        error: mocks.toastError,
    },
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

const analyst = {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'analyst1',
    full_name: 'Analyst One',
    role: 'analyst',
    email: 'analyst1@example.com',
    lab: 'Lab A',
    can_access_confidential: false,
    created_at: '2026-04-09T00:00:00.000Z',
    updated_at: '2026-04-09T00:00:00.000Z',
} as User

function createDeferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })

    return { promise, resolve, reject }
}

function renderUserList() {
    return render(
        <UserListTable
            users={[analyst]}
            page={1}
            pageSize={10}
            totalPages={1}
            totalCount={1}
            currentUserRole="manager"
        />,
    )
}

async function requestDelete(user: ReturnType<typeof userEvent.setup>) {
    const overflowTrigger = screen.getByRole('button', {
        name: 'Mở menu thao tác cho analyst1',
    })

    await user.click(overflowTrigger)
    await user.click(screen.getByRole('menuitem', { name: 'Xóa người dùng' }))

    return overflowTrigger
}

describe('UserListTable delete confirmation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.deleteUser.mockResolvedValue({ success: true })
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('opens a confirmation dialog before calling the delete API', async () => {
        const user = userEvent.setup()
        renderUserList()

        await requestDelete(user)

        expect(mocks.deleteUser).not.toHaveBeenCalled()
        expect(screen.getByRole('alertdialog')).toBeDefined()
        expect(screen.getByText('Xác nhận xóa người dùng')).toBeDefined()
        expect(screen.getByText(
            'Tài khoản Analyst One (analyst1) sẽ bị vô hiệu hóa, không thể đăng nhập và dữ liệu lịch sử vẫn được giữ lại.',
        )).toBeDefined()
    })

    it('cancels without deleting and restores focus to the overflow trigger', async () => {
        const user = userEvent.setup()
        renderUserList()

        const overflowTrigger = await requestDelete(user)
        await user.click(screen.getByRole('button', { name: 'Hủy' }))

        await waitFor(() => {
            expect(screen.queryByRole('alertdialog')).toBeNull()
            expect(document.activeElement).toBe(overflowTrigger)
        })
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })

    it('deletes successfully with pending feedback, toast, refresh and focus restoration', async () => {
        const user = userEvent.setup()
        const deferred = createDeferred<{ success: true }>()
        mocks.deleteUser.mockReturnValue(deferred.promise)
        renderUserList()

        const overflowTrigger = await requestDelete(user)
        const cancelButton = screen.getByRole('button', { name: 'Hủy' }) as HTMLButtonElement
        await user.click(screen.getByRole('button', { name: 'Xóa người dùng' }))

        expect(mocks.deleteUser).toHaveBeenCalledTimes(1)
        expect(mocks.deleteUser).toHaveBeenCalledWith(analyst.id)
        expect(cancelButton.disabled).toBe(true)
        expect(
            (screen.getByRole('button', { name: 'Đang xóa...' }) as HTMLButtonElement).disabled,
        ).toBe(true)

        deferred.resolve({ success: true })

        await waitFor(() => {
            expect(mocks.toastSuccess).toHaveBeenCalledWith(
                'Đã xóa người dùng analyst1',
            )
            expect(screen.queryByRole('alertdialog')).toBeNull()
            expect(document.activeElement).toBe(overflowTrigger)
        })
        expect(mocks.refresh).toHaveBeenCalledTimes(1)
        expect(window.confirm).not.toHaveBeenCalled()
        expect(window.alert).not.toHaveBeenCalled()
    })

    it('cannot close or submit twice while deletion is pending', async () => {
        const user = userEvent.setup()
        const deferred = createDeferred<{ success: true }>()
        mocks.deleteUser.mockReturnValue(deferred.promise)
        renderUserList()

        await requestDelete(user)
        const submitButton = screen.getByRole('button', {
            name: 'Xóa người dùng',
        }) as HTMLButtonElement
        await user.click(submitButton)

        await user.keyboard('{Escape}')
        fireEvent.pointerDown(document.body)
        fireEvent.click(document.body)
        await user.click(submitButton)

        expect(screen.getByRole('alertdialog')).toBeDefined()
        expect(mocks.deleteUser).toHaveBeenCalledTimes(1)

        deferred.resolve({ success: true })
        await waitFor(() => {
            expect(screen.queryByRole('alertdialog')).toBeNull()
        })
    })

    it('keeps the dialog open and shows the API result error', async () => {
        const user = userEvent.setup()
        mocks.deleteUser.mockResolvedValue({
            success: false,
            error: 'Không thể vô hiệu hóa tài khoản',
        })
        renderUserList()

        await requestDelete(user)
        await user.click(screen.getByRole('button', { name: 'Xóa người dùng' }))

        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith(
                'Không thể vô hiệu hóa tài khoản',
            )
        })
        expect(screen.getByRole('alertdialog')).toBeDefined()
        expect(mocks.refresh).not.toHaveBeenCalled()
        expect(window.confirm).not.toHaveBeenCalled()
        expect(window.alert).not.toHaveBeenCalled()
    })

    it('keeps the dialog open and shows a rejected request error', async () => {
        const user = userEvent.setup()
        mocks.deleteUser.mockRejectedValue(new Error('Kết nối thất bại'))
        renderUserList()

        await requestDelete(user)
        await user.click(screen.getByRole('button', { name: 'Xóa người dùng' }))

        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith('Kết nối thất bại')
        })
        expect(screen.getByRole('alertdialog')).toBeDefined()
        expect(mocks.refresh).not.toHaveBeenCalled()
    })
})
