# Standard Form Dialog Content Design

## Context

The user management dialog uses `sm:max-w-[500px]`, while the assay definition
dialog uses `sm:max-w-[700px] max-h-[90vh] overflow-y-auto`. The narrower user
dialog looks inconsistent with the larger management forms and has less room for
its fields.

## Decision

Create a focused `FormDialogContent` component that wraps the existing
`DialogContent`. Its default layout matches the assay definition dialog:

- `sm:max-w-[700px]`
- `max-h-[90vh]`
- `overflow-y-auto`

The wrapper accepts the same props as `DialogContent` and merges an optional
`className`, so callers can extend the layout without duplicating the standard
form-dialog classes.

## Scope

Replace direct `DialogContent` usage in:

- `src/components/user-dialog.tsx`
- `src/components/assay-definition-dialog.tsx`

Do not change other dialogs. Their sizes may reflect different workflows and
should be migrated only through separate, intentional changes.

## Testing

Add focused regression coverage that:

- verifies the shared component applies the standard width, viewport height, and
  vertical overflow classes;
- verifies caller-provided classes are preserved;
- verifies both target dialogs use the shared component rather than duplicating
  sizing classes.

Run the focused test, TypeScript typecheck, and relevant React quality checks.
Use rendered component tests to verify both dialogs receive the same responsive
layout contract.
