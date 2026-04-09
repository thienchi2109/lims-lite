import { render, screen } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ResultStatusBadge } from '../result-status-badge'
import { SampleStatusBadge } from '../sample-status-badge'

type MotionDivProps = HTMLAttributes<HTMLDivElement> & {
    animate?: unknown
    children?: ReactNode
}

vi.mock('motion/react', () => ({
    motion: {
        div: ({ animate, children, ...props }: MotionDivProps) => (
            <div data-animate={animate ? 'yes' : 'no'} {...props}>
                {children}
            </div>
        ),
    },
}))

vi.mock('lucide-react', () => ({
    CheckCircle: () => <span data-testid="check-circle-icon" />,
    Clock: () => <span data-testid="clock-icon" />,
    Edit: () => <span data-testid="edit-icon" />,
}))

describe('status badges', () => {
    it('rerenders result status labels across status changes', () => {
        const { rerender } = render(<ResultStatusBadge status="pending" />)

        expect(screen.getByText('Pending')).toBeDefined()

        rerender(<ResultStatusBadge status="approved" />)

        expect(screen.getByText('Approved')).toBeDefined()
    })

    it('rerenders sample status labels across status changes', () => {
        const { rerender } = render(<SampleStatusBadge status="received" />)

        expect(screen.getByText('Đã nhận')).toBeDefined()

        rerender(<SampleStatusBadge status="completed" />)

        expect(screen.getByText('Hoàn thành')).toBeDefined()
    })
})
