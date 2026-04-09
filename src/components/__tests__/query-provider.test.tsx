import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryProvider } from '../query-provider'

vi.mock('motion/react', () => ({
    MotionConfig: ({
        children,
        reducedMotion,
    }: {
        children?: ReactNode
        reducedMotion?: string
    }) => (
        <div data-testid="motion-config" data-reduced-motion={reducedMotion}>
            {children}
        </div>
    ),
}))

vi.mock('@tanstack/react-query-devtools', () => ({
    ReactQueryDevtools: () => null,
}))

describe('QueryProvider', () => {
    it('configures Motion to respect user reduced-motion preferences', () => {
        render(
            <QueryProvider>
                <div>child content</div>
            </QueryProvider>
        )

        expect(screen.getByText('child content')).toBeDefined()
        expect(
            screen.getByTestId('motion-config').getAttribute('data-reduced-motion')
        ).toBe('user')
    })
})
