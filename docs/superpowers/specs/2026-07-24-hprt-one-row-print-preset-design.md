# HPRT One-Row Barcode Print Preset

## Problem

The current standard barcode preset uses a `71.1mm x 89mm` browser page. Its
first `22.9mm` row contains two side-by-side labels and the remaining page area
is blank. The physical printer therefore advances approximately three unused
rows between independent print jobs.

Changing the existing preset to `71.1mm x 22.9mm` caused the Windows HPRT
driver, while still using its `4x4` media profile, to rotate the output by 90
degrees. The existing preset must remain unchanged because it is the verified
fallback for correct horizontal label content.

## Design

Add a separate sample-label preset with the machine-readable identifier
`thermal-35x23-hprt-one-row-2up`.

- Browser page: `71.1mm x 22.9mm`
- Layout: two columns of `35.5mm x 22.9mm`
- Column gap: `0mm`
- Horizontal positioning: left aligned, leaving the existing unallocated
  `0.1mm` at the right edge; do not stretch either label column
- Barcode and metadata layout: reuse the existing compact standard template
- Default preset: remain `thermal-35x23-sheet-2up`
- Existing standard page: remain `71.1mm x 89mm`

The new preset is an explicit opt-in. Its UI copy must state that it requires a
matching `71.1mm x 22.9mm` HPRT driver profile. Selecting it must not modify the
existing standard preset or silently make it the default.

The selected value continues to use the existing browser `localStorage`
preference. No database persistence or migration is required.

The HPRT identifier is a frontend render variant only. The print client passes
`thermal-35x23-hprt-one-row-2up` to the HTML renderer, but maps it to the
existing `thermal-35x23-sheet-2up` identifier when recording the print audit.
The server action, RPC contract, and database whitelist remain unchanged.

## Validation Boundary

The web application can control the browser page but cannot create or select a
custom Windows printer-driver media profile. Physical validation therefore
requires the client computer to use a matching custom HPRT media definition.

Automated tests will verify:

- the existing standard preset and default remain unchanged;
- the new preset generates an exact `71.1mm x 22.9mm` browser page containing
  two fixed `35.5mm x 22.9mm` columns;
- the new preset is selectable and persisted by the print dialog;
- the dialog displays the matching HPRT driver-profile requirement;
- the renderer receives the HPRT one-row preset;
- the audit request continues to use the existing standard preset identifier.

Physical testing will determine whether the HPRT driver preserves horizontal
orientation and advances exactly one row. The new preset remains opt-in even
after successful physical testing. Making it the default requires a separate
reviewed change.

## Rollback

Because the existing preset remains unchanged and default, rollback during
physical testing is immediate: reselect the application preset
`thermal-35x23-sheet-2up` and its matching Windows `4x4` media profile. No
database or migration changes are involved.
