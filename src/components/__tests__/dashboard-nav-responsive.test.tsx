import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
    usePathname: () => '/manager/users',
}))

import { DashboardNav } from '../dashboard-nav'

const manager = {
    full_name: 'Manager A',
    role: 'manager' as const,
}

const managerDestinations = [
    { href: '/manager', label: 'Trang chủ' },
    { href: '/manager/samples', label: 'Quản lý mẫu' },
    { href: '/manager/approvals', label: 'Phê duyệt' },
    { href: '/manager/assays', label: 'Chỉ tiêu' },
    { href: '/manager/quality-control', label: 'QA/QC' },
    { href: '/manager/users', label: 'Người dùng' },
    { href: '/manager/reports', label: 'Báo cáo' },
    { href: '/manager/qr-code', label: 'Mã QR' },
]

beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    }

    Object.defineProperties(HTMLElement.prototype, {
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

describe('DashboardNav responsive variants', () => {
    it('renders all manager destinations as stable accessible compact links', () => {
        render(<DashboardNav user={manager} variant="compact" />)

        const links = screen.getAllByRole('link')
        expect(links).toHaveLength(8)

        managerDestinations.forEach(({ href, label }) => {
            const link = screen.getByRole('link', { name: label })

            expect(link.getAttribute('href')).toBe(href)
            expect(link.className).toContain('h-10')
            expect(link.className).toContain('w-10')
            expect(link.className).toContain('shrink-0')
            expect(link.className).toContain('focus-visible:ring-2')
            expect(link.className).toContain('dark:focus-visible:ring-blue-400')
            expect(link.textContent).toBe('')
        })

        expect(
            screen.getByRole('link', { name: 'Người dùng' }).getAttribute('aria-current'),
        ).toBe('page')
    })

    it('shows compact route labels in tooltips on hover and keyboard focus', async () => {
        const user = userEvent.setup()
        const { unmount } = render(
            <DashboardNav user={manager} variant="compact" />,
        )

        const usersLink = screen.getByRole('link', { name: 'Người dùng' })

        await user.hover(usersLink)
        expect((await screen.findByRole('tooltip')).textContent).toContain('Người dùng')

        unmount()
        render(<DashboardNav user={manager} variant="compact" />)

        fireEvent.focus(screen.getByRole('link', { name: 'Người dùng' }))
        expect((await screen.findByRole('tooltip')).textContent).toContain('Người dùng')
    })

    it('renders full navigation with visible nonwrapping labels', () => {
        render(<DashboardNav user={manager} variant="full" />)

        const links = screen.getAllByRole('link')
        expect(links).toHaveLength(8)

        managerDestinations.forEach(({ href, label }) => {
            const link = screen.getByRole('link', { name: label })

            expect(link.getAttribute('href')).toBe(href)
            expect(link.className).toContain('shrink-0')
            expect(link.className).toContain('whitespace-nowrap')
            expect(link.textContent).toContain(label)
        })

        expect(
            screen.getByRole('link', { name: 'Người dùng' }).getAttribute('aria-current'),
        ).toBe('page')
        expect(
            screen.queryByRole('button', { name: 'Mở menu điều hướng' }),
        ).toBeNull()
    })

    it('opens the mobile Sheet and exposes every route with active semantics', async () => {
        const user = userEvent.setup()
        render(<DashboardNav user={manager} variant="mobile" />)

        const trigger = await screen.findByRole('button', {
            name: 'Mở menu điều hướng',
        })
        expect(screen.queryAllByRole('link')).toHaveLength(0)

        await user.click(trigger)

        const links = await screen.findAllByRole('link')
        expect(links).toHaveLength(8)

        managerDestinations.forEach(({ href, label }) => {
            expect(screen.getByRole('link', { name: label }).getAttribute('href')).toBe(href)
        })
        expect(
            screen.getByRole('link', { name: 'Người dùng' }).getAttribute('aria-current'),
        ).toBe('page')
    })
})
