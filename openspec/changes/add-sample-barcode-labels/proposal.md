## Why

Manual handwriting on sample containers increases the risk of mislabeling, especially when one client has multiple independent samples such as blood and urine. Barcode labels let staff identify each physical container by the existing unique `sample_id` without exposing sensitive client, test, or HIV/confidential information on the tube.

## What Changes

- Add local barcode label printing for each `samples` record, using `sample_id` as the only encoded value.
- Add small tube label and larger container label presets with Vietnamese UI labels.
- Add audited print/reprint requests before opening the browser print flow.
- Add privacy guardrails so labels never include client identity, phone, CCCD, assay/test names, result status, HIV/confidential markers, portal URLs, or tokens.
- Add print entry points after accession success, in the sample detail panel, and beside the existing Phiếu chỉ định print action.

## Capabilities

### New Capabilities
- `sample-barcode-labels`: Print privacy-safe barcode labels for physical sample containers.

### Modified Capabilities
- `sample-management`: Samples can be identified by printed barcode labels, and label print requests are audited.

## Impact

- Affected code: accession form success UI, sample detail panel, assigned-tests toolbar, print handlers/templates, client-actions route, sample-related server action/RPC wiring.
- Affected database: migration adds a `SECURITY DEFINER` RPC to audit label print requests through existing `audit_logs`.
- Dependencies: add a local barcode generator such as `bwip-js`; do not use external barcode/QR services for sample labels.
- Compliance/security: print/reprint is audited; RLS/confidential access must fail closed for HIV/confidential-associated samples.
