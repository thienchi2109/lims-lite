import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SampleLabelPrintDialog } from './sample-label-print-dialog'

const mockSetItem = vi.fn()

Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: vi.fn(),
        setItem: mockSetItem,
    },
    writable: true,
})

describe('SampleLabelPrintDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    })

    it('defaults to the printer-template two-column thermal preset and saves the choice before printing', () => {
        const onPrint = vi.fn()

        render(
            <SampleLabelPrintDialog
                open
                onOpenChange={vi.fn()}
                onPrint={onPrint}
            />,
        )

        expect(screen.getByLabelText<HTMLInputElement>('35.5 x 22.9mm - template chuẩn').checked).toBe(true)
        expect(screen.getByLabelText<HTMLInputElement>('35 x 22mm - 2 tem ngang cũ')).toBeDefined()
        expect(screen.getByText('Khổ trang 71.1 x 89mm, in 1 hàng gồm 2 tem 35.5 x 22.9mm ở mép trên.')).toBeDefined()

        fireEvent.click(screen.getByRole('button', { name: 'In nhãn' }))

        expect(mockSetItem).toHaveBeenCalledWith('sample-label-print-preset', 'thermal-35x23-sheet-2up')
        expect(onPrint).toHaveBeenCalledWith('thermal-35x23-sheet-2up')
    })

    it('selects and persists the opt-in HPRT one-row preset with its driver warning', () => {
        const onPrint = vi.fn()

        render(
            <SampleLabelPrintDialog
                open
                onOpenChange={vi.fn()}
                onPrint={onPrint}
            />,
        )

        const presetRadios = screen.getAllByRole<HTMLInputElement>('radio')
        expect(presetRadios[0]?.value).toBe('thermal-35x23-sheet-2up')
        expect(presetRadios[1]?.value).toBe('thermal-35x23-hprt-one-row-2up')

        fireEvent.click(screen.getByLabelText('HPRT HT300/HT330 - 2 tem / 1 hàng'))

        expect(screen.getByText(
            'Khổ 71.1 x 22.9mm. Chỉ dùng với profile driver cùng kích thước; không chọn profile 4x4.',
        )).toBeDefined()

        fireEvent.click(screen.getByRole('button', { name: 'In nhãn' }))

        expect(mockSetItem).toHaveBeenCalledWith(
            'sample-label-print-preset',
            'thermal-35x23-hprt-one-row-2up',
        )
        expect(onPrint).toHaveBeenCalledWith('thermal-35x23-hprt-one-row-2up')
    })

    it('uses the last saved preset when the dialog opens', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue('container')

        render(
            <SampleLabelPrintDialog
                open
                onOpenChange={vi.fn()}
                onPrint={vi.fn()}
            />,
        )

        expect(screen.getByLabelText<HTMLInputElement>('50 x 25mm - 1 tem').checked).toBe(true)
    })
})
