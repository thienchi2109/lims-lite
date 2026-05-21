## Overview

One `samples` row represents one physical container. Barcode labels therefore belong to `samples`, not to a new container table. The label encodes only `sample.sample_id` as CODE128 and displays a compact set of operational fields: sample ID, sample type, received timestamp, and the receiver identity derived from `received_by_name`.

## UI and Workflow

- Primary workflow: after successful accession, show a success CTA `In nhãn barcode`. Do not auto-open print preview.
- Reprint workflow: show a compact barcode/print action in `SampleDetailPanel` near the displayed sample ID.
- Convenience workflow: add `In nhãn barcode` beside `In Phiếu chỉ định` in `AssignedTestsToolbar`.
- Do not add a row-level barcode button to `SampleListTable` in this change, to reduce accidental prints from the dense grid.

## Label Content and Layout

- Default preset: `small-tube`, `40mm x 15mm`.
- Secondary preset: `container`, `50mm x 25mm`.
- CODE128 barcode is generated locally with `bwip-js`.
- The small label displays `sample_id`, barcode, short sample type, received date/time, and receiver initials.
- The large label may show the full receiver name if it fits.
- Labels must not include client name, phone, CCCD, assay/test names, result values/status, HIV/confidential markers, portal URLs, or access tokens.

## Audit and Authorization

- Printing calls `record_sample_label_print(sample_uuid, copies, preset)` before opening the print window.
- The RPC is `SECURITY DEFINER`, uses a fixed `search_path`, requires analyst or manager role, and validates sample access server-side.
- Confidential-associated samples must fail closed unless the caller can access confidential samples.
- Audit is recorded in existing `audit_logs` with operation `LABEL_PRINT_REQUESTED`.
- Audit payload stores non-sensitive metadata only: sample UUID, sample display ID, copies, preset, and label version.
- Browser APIs cannot confirm physical printer completion, so the audit event represents a print request.

## Implementation Notes

- Keep the barcode label template separate from `generatePrintTemplate` for Phiếu chỉ định.
- Reuse existing `fetchSampleDetail`/sample detail authorization before printing.
- Use `received_by_name` from the sample record for label display; current session user is only the print requester in audit.
- Keep UI labels Vietnamese and use icon-only buttons with accessible text/tooltips where space is tight.
