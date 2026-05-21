## 1. RED: Tests First
- [x] 1.1 Add failing label template tests for CODE128 payload, tube layout, receiver display, and privacy exclusions.
- [x] 1.2 Add failing print handler tests that require audit success before opening print preview.
- [x] 1.3 Add failing server/RPC tests for authorized, unauthorized, and confidential-associated print requests.
- [x] 1.4 Add failing UI tests for accession success CTA, sample detail reprint action, and assigned-tests toolbar action.

## 2. Database and Server Audit Path
- [x] 2.1 Add migration for `record_sample_label_print(sample_uuid, copies, preset)` with role checks, fixed `search_path`, confidential fail-closed guard, and Security Impact comments.
- [x] 2.2 Add server action and client-action route wiring for label print audit.
- [x] 2.3 Add API client wrapper for label print audit.

## 3. Barcode Label Printing
- [x] 3.1 Add local barcode dependency and label SVG generation helper.
- [x] 3.2 Add sample label HTML template with `small-tube` and `container` presets.
- [x] 3.3 Add print handler that fetches authorized sample detail, records audit, renders the label, and opens print preview.

## 4. UI Wiring
- [x] 4.1 Add `In nhãn barcode` CTA to accession success state without auto-printing.
- [x] 4.2 Add reprint action near sample ID in the sample detail panel.
- [x] 4.3 Add barcode print action beside `In Phiếu chỉ định` in assigned-tests toolbar.

## 5. Verification
- [x] 5.1 Apply migration via Docker and run `SELECT * FROM run_security_tests();`.
- [x] 5.2 Run focused test files for labels, print handler, server action/RPC, accession, sample detail, and assigned-tests toolbar.
- [x] 5.3 Run `npm run typecheck`.
- [x] 5.4 Validate OpenSpec with `openspec validate add-sample-barcode-labels --strict`.
