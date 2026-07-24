# HPRT One-Row Barcode Print Preset Implementation Plan

**Goal:** Add an opt-in HPRT HT300/HT330 frontend print profile that renders
exactly one row of two labels without changing the verified standard profile.

**Scope:** Frontend print layout and client-side preset selection only. Do not
change the server action contract, RPC, database whitelist, or migrations.

**Architecture:** Keep `thermal-35x23-sheet-2up` as the default and audited
preset. Add `thermal-35x23-hprt-one-row-2up` as a render-only variant. The print
client maps that variant back to the standard preset for audit recording while
passing the HPRT identifier to the HTML renderer.

## Task 1: Lock the layout with tests

**Files:**
- `src/lib/sample-label-template.test.ts`
- `src/components/sample-label-print-dialog.test.tsx`

- [x] Assert the HPRT page is `71.1mm x 22.9mm`.
- [x] Assert two fixed `35.5mm x 22.9mm` labels with a `0mm` gap.
- [x] Assert the standard page remains `71.1mm x 89mm`.
- [x] Assert the standard preset remains the default.
- [x] Assert the option is selectable and persisted in `localStorage`.
- [x] Display the matching HPRT driver profile requirement.

## Task 2: Add the frontend preset

**Files:**
- `src/lib/sample-label-template.ts`
- `src/components/sample-label-print-dialog.tsx`

- [x] Add the render preset identifier.
- [x] Reuse the verified compact horizontal label content.
- [x] Add `HPRT HT300/HT330 - 2 tem / 1 hàng` after the standard option.
- [x] Keep the existing standard option and default unchanged.

## Task 3: Preserve the existing audit contract

**Files:**
- `src/lib/api-client.ts`
- `src/lib/sample-label-print-client.ts`
- `src/lib/sample-label-print-client.test.ts`

- [x] Pass the HPRT identifier to `generateSampleLabelHtml`.
- [x] Map the HPRT identifier to `thermal-35x23-sheet-2up` before audit.
- [x] Narrow the audit client type so it cannot accept the render-only preset.
- [x] Leave `src/app/actions/samples.ts` unchanged from `main`.
- [x] Add no SQL or migration files.

## Task 4: Verify and review

- [x] Run the four focused barcode-print test files.
- [x] Run TypeScript typecheck.
- [x] Run ESLint for changed source and test files.
- [x] Run the production build.
- [x] Confirm the final diff contains no server action, SQL, or migration change.
- [x] Spawn an independent subagent for code review and address valid findings.

## Task 5: Deploy the application

- [ ] Commit and push the reviewed branch.
- [ ] Merge the reviewed change.
- [ ] Update `/opt/lims-lite` on `khoa-xn-cdc`.
- [ ] Rebuild and replace only the application service.
- [ ] Do not run any database or migration command.
- [ ] Verify the deployed commit and application health.

## Task 6: Physical validation

This remains pending until the printer is available.

- [ ] Select `HPRT HT300/HT330 - 2 tem / 1 hàng` in LIMS.
- [ ] Select a matching `71.1mm x 22.9mm` HPRT media profile in Windows.
- [ ] Confirm the labels remain horizontal.
- [ ] Confirm the next print starts on the immediately following row.
- [ ] If validation fails, return to the standard app preset and `4x4` driver
  profile without changing the default.
