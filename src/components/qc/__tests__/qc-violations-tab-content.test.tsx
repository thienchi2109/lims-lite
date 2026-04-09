import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { QCViolationsTabContent } from '../qc-violations-tab-content'
import type { PendingViolation } from '../qc-overview-tab'

vi.mock('../violation-resolution-dialog', () => ({
    ViolationResolutionDialog: ({ violation, trigger }: {
        violation: { rule_violated: string }
        trigger: ReactNode
    }) => (
        <div data-testid="resolution-dialog" data-rule={violation.rule_violated}>
            {trigger}
        </div>
    ),
}))

function createViolation(rule_violated: string): PendingViolation {
    return {
        id: 'violation-1',
        rule_violated,
        z_score: 3.25,
        value: 10,
        mean: 5,
        sd: 1.5,
        assay_name: 'Glucose',
        assay_units: 'mg/dL',
        material_name: 'QC Level 1',
        material_level: 'L1',
        session_mode: 'daily',
        created_at: '2026-04-09T00:00:00.000Z',
    }
}

describe('QCViolationsTabContent', () => {
    it('passes recognized Westgard rules to the resolution dialog', () => {
        render(<QCViolationsTabContent violations={[createViolation('1-3s')]} />)

        expect(screen.getByTestId('resolution-dialog').dataset.rule).toBe('1-3s')
        expect(screen.getByRole('button', { name: 'Xử lý vi phạm' })).toBeDefined()
    })

    it('does not resolve a violation with an unrecognized Westgard rule', () => {
        expect(() => {
            render(<QCViolationsTabContent violations={[createViolation('unexpected-rule')]} />)
        }).not.toThrow()

        expect(screen.getByText(/unexpected-rule/)).toBeDefined()
        expect(screen.queryByTestId('resolution-dialog')).toBeNull()
        expect(screen.getByRole('button', { name: 'Quy tắc không hợp lệ' }))
            .toHaveProperty('disabled', true)
    })
})
