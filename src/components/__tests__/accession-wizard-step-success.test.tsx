import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
    default: ({
        children,
        href,
        className,
    }: {
        children: React.ReactNode
        href: string
        className?: string
    }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}))

import { AccessionWizardStepSuccess } from '../accession-wizard-step-success'

describe('AccessionWizardStepSuccess', () => {
    it('renders the home action as a single link element without a nested button', () => {
        render(
            <AccessionWizardStepSuccess
                successMessage="Mẫu SMP-123 đã được tạo."
                clientName="Nguyen Van A"
                sampleType="Máu"
                testCount={2}
                onNewAccession={vi.fn()}
            />,
        )

        const homeLink = screen.getByRole('link', { name: /Quay lại trang chủ/i })

        expect(homeLink.getAttribute('href')).toBe('/analyst')
        expect(homeLink.querySelector('button')).toBeNull()
    })
})
