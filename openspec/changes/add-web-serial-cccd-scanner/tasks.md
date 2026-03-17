## 1. Spec and support model

- [ ] 1.1 Add `sample-management` deltas for Web Serial CCCD scanning, browser permission flow, and fallback continuity.
- [ ] 1.2 Document the primary runtime target as Windows Chrome/Edge analyst accession.

## 2. Browser-side serial reader

- [ ] 2.1 Add failing tests for serial support detection, UTF-8 decoding, framing, and resume behavior.
- [ ] 2.2 Implement a Web Serial CCCD reader module with request/resume/disconnect lifecycle management.
- [ ] 2.3 Sanitize emitted payloads so they are compatible with the existing CCCD parser.

## 3. Dialog and accession integration

- [ ] 3.1 Add failing component tests for serial connection UI, auto-resume behavior, and fallback continuity.
- [ ] 3.2 Extend the client QR scanner dialog with Web Serial state and actions while keeping camera and keyboard fallback paths.
- [ ] 3.3 Add page-scoped accession integration so the serial connection persists across dialog reopen within the same session.

## 4. Verification

- [ ] 4.1 Run focused Vitest coverage for the serial module and QR dialog/accession paths.
- [ ] 4.2 Run `npm run typecheck`.
- [ ] 4.3 Run `npm run build`.
