import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseApprovalCount = vi.fn()

vi.mock('@/hooks/use-approval-count', () => ({
    useApprovalCount: () => mockUseApprovalCount(),
}))

import { ManagerDashboardClient } from '../manager-dashboard-client'

describe('ManagerDashboardClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders an amber alert banner when pending approvals exist', () => {
        mockUseApprovalCount.mockReturnValue({ data: 5 })

        render(<ManagerDashboardClient user={{ full_name: 'Tran Thi B' }} />)

        expect(screen.getByText('Xin chào,')).toBeDefined()
        expect(screen.getByText('Tran Thi B')).toBeDefined()
        expect(screen.getByRole('alert')).toBeDefined()
        expect(screen.getByText('Bạn có 5 mẫu đang chờ phê duyệt')).toBeDefined()
        expect(screen.getByRole('link', { name: 'Mở hàng đợi' }).getAttribute('href')).toBe(
            '/manager/approvals',
        )
    })

    it('hides the alert banner when there are no pending approvals', () => {
        mockUseApprovalCount.mockReturnValue({ data: 0 })

        const { container } = render(<ManagerDashboardClient user={{ full_name: 'Tran Thi B' }} />)

        expect(screen.queryByRole('alert')).toBeNull()

        const grid = container.querySelector('.grid')
        expect(grid?.className).toContain('mt-0')
    })

    it('links managers to the client lifecycle workspace', () => {
        mockUseApprovalCount.mockReturnValue({ data: 0 })

        render(<ManagerDashboardClient user={{ full_name: 'Tran Thi B' }} />)

        expect(
            screen.getByRole('link', { name: /Quản lý khách hàng/i }).getAttribute('href'),
        ).toBe('/manager/clients')
    })
})
