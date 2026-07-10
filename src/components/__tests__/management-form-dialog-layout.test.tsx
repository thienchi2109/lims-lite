import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UserDialog } from '../user-dialog'

vi.mock('../user-form', () => ({
  UserForm: () => <div>Biểu mẫu người dùng</div>,
}))

const dialogSourcePaths = [
  resolve(process.cwd(), 'src/components/user-dialog.tsx'),
  resolve(process.cwd(), 'src/components/assay-definition-dialog.tsx'),
]

describe('management form dialog layout', () => {
  it('renders the user dialog with the assay dialog dimensions', () => {
    render(
      <UserDialog
        open
        onOpenChange={vi.fn()}
        mode="create"
        currentUserRole="manager"
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('sm:max-w-[700px]')
    expect(dialog.className).toContain('max-h-[90vh]')
    expect(dialog.className).toContain('overflow-y-auto')
  })

  it('uses shared form dialog content without caller-owned sizing classes', () => {
    for (const sourcePath of dialogSourcePaths) {
      const source = readFileSync(sourcePath, 'utf8')

      expect(source).toContain('FormDialogContent')
      expect(source).toContain('<FormDialogContent')
      expect(source).not.toContain('sm:max-w-[500px]')
      expect(source).not.toContain('sm:max-w-[700px]')
      expect(source).not.toContain('max-h-[90vh]')
      expect(source).not.toContain('overflow-y-auto')
    }
  })
})
