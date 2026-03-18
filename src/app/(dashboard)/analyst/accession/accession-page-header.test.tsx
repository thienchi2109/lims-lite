import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/walkthrough', () => ({
    WalkthroughTrigger: ({
        className,
    }: {
        className?: string
    }) => (
        <button
            type="button"
            data-testid="walkthrough-trigger"
            className={className}
        >
            Hướng dẫn
        </button>
    ),
}))

import { AccessionPageHeader } from './accession-page-header'

describe('AccessionPageHeader', () => {
    it('hides the walkthrough trigger while the mobile accession UI is active', () => {
        render(<AccessionPageHeader />)

        const trigger = screen.getByTestId('walkthrough-trigger')

        expect(trigger.className).toContain('hidden')
        expect(trigger.className).toContain('xl:inline-flex')
    })
})
