import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from '../ui/checkbox'

describe('Checkbox indeterminate icon', () => {
    it('renders only MinusIcon for an uncontrolled indeterminate checkbox and updates after interaction', () => {
        const onCheckedChange = vi.fn()

        render(
            <Checkbox
                aria-label="Chọn tất cả"
                defaultChecked="indeterminate"
                onCheckedChange={onCheckedChange}
            />,
        )

        const checkbox = screen.getByRole('checkbox', { name: 'Chọn tất cả' })
        expect(checkbox.getAttribute('data-state')).toBe('indeterminate')
        expect(checkbox.querySelectorAll('.lucide-minus')).toHaveLength(1)
        expect(checkbox.querySelector('.lucide-check')).toBeNull()

        fireEvent.click(checkbox)

        expect(onCheckedChange).toHaveBeenLastCalledWith(true)
        expect(checkbox.getAttribute('data-state')).toBe('checked')
        expect(checkbox.querySelectorAll('.lucide-check')).toHaveLength(1)
        expect(checkbox.querySelector('.lucide-minus')).toBeNull()
    })

    it('renders the icon for the current controlled state', () => {
        const { rerender } = render(
            <Checkbox aria-label="Chọn nhóm" checked="indeterminate" />,
        )

        const checkbox = screen.getByRole('checkbox', { name: 'Chọn nhóm' })
        expect(checkbox.querySelectorAll('.lucide-minus')).toHaveLength(1)
        expect(checkbox.querySelector('.lucide-check')).toBeNull()

        rerender(<Checkbox aria-label="Chọn nhóm" checked />)

        expect(checkbox.getAttribute('data-state')).toBe('checked')
        expect(checkbox.querySelectorAll('.lucide-check')).toHaveLength(1)
        expect(checkbox.querySelector('.lucide-minus')).toBeNull()
    })
})
