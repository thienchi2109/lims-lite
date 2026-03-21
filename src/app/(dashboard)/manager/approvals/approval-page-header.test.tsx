import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/walkthrough', () => ({
    WalkthroughTrigger: ({
        className,
        autoShowTooltip,
    }: {
        className?: string
        autoShowTooltip?: boolean
    }) => (
        <button
            type="button"
            data-testid="walkthrough-trigger"
            data-auto-show-tooltip={String(autoShowTooltip)}
            className={className}
        >
            Hướng dẫn
        </button>
    ),
}))

import { ApprovalPageHeader } from './approval-page-header'

describe('ApprovalPageHeader', () => {
    it('disables walkthrough auto-tooltip so sample selection does not re-trigger the help hint', () => {
        render(<ApprovalPageHeader samplesCount={12} tab="completed" />)

        const trigger = screen.getByTestId('walkthrough-trigger')

        expect(trigger.getAttribute('data-auto-show-tooltip')).toBe('false')
    })
})
