import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mockUseRejectionCount = vi.fn()

vi.mock('@/hooks/use-rejection-count', () => ({
    useRejectionCount: () => mockUseRejectionCount(),
}))

import { AnalystDashboardClient } from '../analyst-dashboard-client'

describe('AnalystDashboardClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the rejection banner and badge when count is greater than zero', () => {
        mockUseRejectionCount.mockReturnValue({ data: 4 })

        render(<AnalystDashboardClient user={{ full_name: 'Nguyen Van A' }} />)

        expect(screen.getByText('Xin chào,')).toBeDefined()
        expect(screen.getByText('Nguyen Van A')).toBeDefined()
        expect(screen.getByRole('alert')).toBeDefined()
        expect(screen.getByText('Bạn có 4 mẫu bị từ chối')).toBeDefined()
        expect(
            screen.getByRole('link', { name: 'Mở danh sách mẫu' }).getAttribute('href'),
        ).toBe('/samples?status=in_progress&rejectedOnly=true')

        const sampleCard = screen.getByText('Danh sách mẫu').closest('a')
        expect(sampleCard).not.toBeNull()
        expect(within(sampleCard as HTMLElement).getByText('4')).toBeDefined()
    })

    it('hides the rejection banner and badge when count is zero', () => {
        mockUseRejectionCount.mockReturnValue({ data: 0 })

        const { container } = render(<AnalystDashboardClient user={{ full_name: 'Nguyen Van A' }} />)

        expect(screen.queryByRole('alert')).toBeNull()

        const sampleCard = screen.getByText('Danh sách mẫu').closest('a')
        expect(sampleCard).not.toBeNull()
        expect(within(sampleCard as HTMLElement).queryByText('0')).toBeNull()

        const grid = container.querySelector('.grid')
        expect(grid?.className).toContain('mt-0')
    })
})
