# Standard Form Dialog Content Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the user and assay management dialogs on a reusable 700px form-dialog layout.

**Architecture:** Add a focused `FormDialogContent` wrapper around the existing `DialogContent`. The wrapper owns the standard width, viewport-height, and vertical-scroll classes while preserving the base dialog API and caller-provided classes.

**Tech Stack:** React 19, TypeScript, Radix Dialog, Tailwind CSS, Vitest, Testing Library

---

## Chunk 1: Shared Form Dialog Layout

### Task 1: Lock the shared layout contract with a failing regression test

**Files:**
- Create: `src/components/ui/form-dialog-content.test.tsx`
- Create: `src/components/__tests__/user-dialog.test.tsx`
- Modify: `src/components/__tests__/assay-definition-dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create a test that first checks the planned component file exists, then renders
the component and checks its layout classes. Also read both target dialog source
files and require them to use the shared wrapper without retaining duplicated
sizing classes:

```tsx
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Dialog } from './dialog'

const componentPath = resolve(process.cwd(), 'src/components/ui/form-dialog-content.tsx')
const userDialogPath = resolve(process.cwd(), 'src/components/user-dialog.tsx')
const assayDialogPath = resolve(process.cwd(), 'src/components/assay-definition-dialog.tsx')

describe('FormDialogContent', () => {
  it('provides the standard form-dialog layout and preserves caller classes', async () => {
    expect(existsSync(componentPath)).toBe(true)
    if (!existsSync(componentPath)) return

    const { FormDialogContent } = await import('./form-dialog-content')

    render(
      <Dialog open>
        <FormDialogContent className="p-8">Nội dung biểu mẫu</FormDialogContent>
      </Dialog>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('sm:max-w-[700px]')
    expect(dialog.className).toContain('max-h-[90vh]')
    expect(dialog.className).toContain('overflow-y-auto')
    expect(dialog.className).toContain('p-8')
  })

  it('is used by the user and assay definition dialogs', () => {
    for (const path of [userDialogPath, assayDialogPath]) {
      const source = readFileSync(path, 'utf8')
      expect(source).toContain('FormDialogContent')
      expect(source).toContain('<FormDialogContent')
      expect(source).not.toContain('sm:max-w-[500px]')
      expect(source).not.toContain('sm:max-w-[700px]')
      expect(source).not.toContain('max-h-[90vh]')
      expect(source).not.toContain('overflow-y-auto')
    }
  })
})
```

- [ ] **Step 2: Add a rendered user-dialog regression test**

Mock only `UserForm`, render `UserDialog` open, and assert the actual dialog
element receives the standard layout:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UserDialog } from '../user-dialog'

vi.mock('../user-form', () => ({
  UserForm: () => <div>Biểu mẫu người dùng</div>,
}))

describe('UserDialog layout', () => {
  it('uses the standard management form-dialog dimensions', () => {
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
})
```

- [ ] **Step 3: Add a rendered assay-dialog layout assertion**

In the existing detail-mode render test in
`src/components/__tests__/assay-definition-dialog.test.tsx`, assert:

```tsx
const dialog = screen.getByRole('dialog')
expect(dialog.className).toContain('sm:max-w-[700px]')
expect(dialog.className).toContain('max-h-[90vh]')
expect(dialog.className).toContain('overflow-y-auto')
```

- [ ] **Step 4: Run the tests to verify RED**

Run:

```bash
rtk npm run test:run -- \
  src/components/ui/form-dialog-content.test.tsx \
  src/components/__tests__/user-dialog.test.tsx \
  src/components/__tests__/assay-definition-dialog.test.tsx
```

Expected: FAIL because `src/components/ui/form-dialog-content.tsx` does not
exist, the user dialog is only 500px wide, and the target dialogs still use
direct `DialogContent`.

### Task 2: Add the shared component and migrate both dialogs

**Files:**
- Create: `src/components/ui/form-dialog-content.tsx`
- Modify: `src/components/user-dialog.tsx`
- Modify: `src/components/assay-definition-dialog.tsx`

- [ ] **Step 1: Implement the minimal shared wrapper**

```tsx
'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { DialogContent } from './dialog'

const FORM_DIALOG_CONTENT_CLASS_NAME =
  'sm:max-w-[700px] max-h-[90vh] overflow-y-auto'

function FormDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(FORM_DIALOG_CONTENT_CLASS_NAME, className)}
      {...props}
    />
  )
}

export { FormDialogContent }
```

- [ ] **Step 2: Replace direct sizing in the user dialog**

Import `FormDialogContent`, remove the `DialogContent` import, and replace:

```tsx
<DialogContent className="sm:max-w-[500px]">
```

with:

```tsx
<FormDialogContent>
```

Update the closing tag accordingly.

- [ ] **Step 3: Replace duplicated sizing in the assay dialog**

Import `FormDialogContent`, remove the `DialogContent` import, and replace:

```tsx
<DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
```

with:

```tsx
<FormDialogContent>
```

Update the closing tag accordingly.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run:

```bash
rtk npm run test:run -- src/components/ui/form-dialog-content.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run immediate blast-radius tests**

Run:

```bash
rtk npm run test:run -- \
  src/components/ui/form-dialog-content.test.tsx \
  src/components/__tests__/user-dialog.test.tsx \
  src/components/__tests__/assay-definition-dialog.test.tsx \
  src/components/__tests__/user-management-manager-permissions.test.tsx
```

Expected: PASS.

### Task 3: Verify quality and rendered behavior

**Files:**
- Verify: `src/components/ui/form-dialog-content.tsx`
- Verify: `src/components/user-dialog.tsx`
- Verify: `src/components/assay-definition-dialog.tsx`

- [ ] **Step 1: Run TypeScript validation**

```bash
rtk npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run focused React quality checks**

```bash
rtk npm run react-doctor:diff
```

Expected: no new critical findings in changed files.

- [ ] **Step 3: Re-run rendered layout tests**

```bash
rtk npm run test:run -- \
  src/components/ui/form-dialog-content.test.tsx \
  src/components/__tests__/user-dialog.test.tsx \
  src/components/__tests__/assay-definition-dialog.test.tsx
```

Expected: PASS. The shared wrapper preserves the base dialog's responsive
viewport width while both management dialogs receive the same 700px desktop
maximum, 90vh height cap, and vertical overflow behavior.

- [ ] **Step 4: Review the diff and file sizes**

```bash
rtk git diff --check
rtk git diff --name-only
rtk git diff -- \
  src/components/ui/form-dialog-content.tsx \
  src/components/ui/form-dialog-content.test.tsx \
  src/components/__tests__/user-dialog.test.tsx \
  src/components/__tests__/assay-definition-dialog.test.tsx \
  src/components/user-dialog.tsx \
  src/components/assay-definition-dialog.tsx
rtk wc -l \
  src/components/ui/form-dialog-content.tsx \
  src/components/ui/form-dialog-content.test.tsx \
  src/components/__tests__/user-dialog.test.tsx \
  src/components/user-dialog.tsx \
  src/components/assay-definition-dialog.tsx
```

Expected: no whitespace errors, only the planned files are changed, no unrelated
dialog is touched, and every file remains below 350 lines.

- [ ] **Step 5: Commit and push**

```bash
rtk git add \
  src/components/ui/form-dialog-content.tsx \
  src/components/ui/form-dialog-content.test.tsx \
  src/components/__tests__/user-dialog.test.tsx \
  src/components/__tests__/assay-definition-dialog.test.tsx \
  src/components/user-dialog.tsx \
  src/components/assay-definition-dialog.tsx \
  docs/superpowers/plans/2026-07-10-standard-form-dialog-content.md
rtk git commit -m "fix: Standardize management form dialogs"
rtk git pull --rebase
rtk git push
rtk git status --short --branch
```

Expected: branch is up to date with `origin/main`.
