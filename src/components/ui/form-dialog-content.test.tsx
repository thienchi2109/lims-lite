import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Dialog, DialogTitle } from './dialog'
import { FormDialogContent } from './form-dialog-content'

describe('FormDialogContent', () => {
  it('preserves the standard layout when callers add classes', () => {
    render(
      <Dialog open>
        <FormDialogContent className="p-8">
          <DialogTitle>Biểu mẫu quản lý</DialogTitle>
        </FormDialogContent>
      </Dialog>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('sm:max-w-[700px]')
    expect(dialog.className).toContain('max-h-[90vh]')
    expect(dialog.className).toContain('overflow-y-auto')
    expect(dialog.className).toContain('p-8')
  })
})
