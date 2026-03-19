import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardAlertBanner } from '../dashboard-alert-banner'

describe('DashboardAlertBanner', () => {
    it('renders nothing when count is zero', () => {
        const { container } = render(
            <DashboardAlertBanner
                count={0}
                variant="warning"
                message="Bạn có {count} mẫu đang chờ phê duyệt"
                linkText="Mở hàng đợi"
                linkHref="/manager/approvals"
            />,
        )

        expect(container.firstChild).toBeNull()
    })

    it('renders the warning variant with count and link', () => {
        render(
            <DashboardAlertBanner
                count={3}
                variant="warning"
                message="Bạn có {count} mẫu đang chờ phê duyệt"
                linkText="Mở hàng đợi"
                linkHref="/manager/approvals"
            />,
        )

        const alert = screen.getByRole('alert')
        expect(alert.className).toContain('border-amber-200')
        expect(alert.className).toContain('bg-amber-50')
        expect(screen.getByText('Bạn có 3 mẫu đang chờ phê duyệt')).toBeDefined()
        expect(screen.getByRole('link', { name: 'Mở hàng đợi' }).getAttribute('href')).toBe(
            '/manager/approvals',
        )
    })

    it('renders the error variant with count and link', () => {
        render(
            <DashboardAlertBanner
                count={2}
                variant="error"
                message="Có {count} mẫu bị từ chối"
                linkText="Xem danh sách mẫu"
                linkHref="/samples"
            />,
        )

        const alert = screen.getByRole('alert')
        expect(alert.className).toContain('border-destructive')
        expect(alert.className).toContain('text-destructive')
        expect(screen.getByText('Có 2 mẫu bị từ chối')).toBeDefined()
        expect(screen.getByRole('link', { name: 'Xem danh sách mẫu' }).getAttribute('href')).toBe(
            '/samples',
        )
    })
})
