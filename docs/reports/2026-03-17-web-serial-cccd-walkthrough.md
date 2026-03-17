# Web Serial CCCD Scanner Walkthrough (2026-03-17)

## Summary

Implemented a Web Serial-first CCCD scanner flow for analyst accession on Windows Chrome/Edge while preserving camera and keyboard fallback paths.

The new flow:
- uses raw COM-port data instead of keyboard emulation for CCCD payloads,
- auto-resumes previously granted serial ports when the accession QR dialog reopens,
- keeps the existing CCCD parse/search/autofill business flow unchanged by continuing to hand off a decoded payload string.

## Phase Commits

- `1d8838f` - `docs: add web serial CCCD change proposal`
- `ca3e0af` - `feat: add web serial CCCD decoder helpers`
- `e614317` - `feat: add serial scanner dialog states`
- `6bb7776` - `feat: integrate web serial CCCD controller`

## Implementation Walkthrough

### 1. OpenSpec change

Added a dedicated OpenSpec change under `openspec/changes/add-web-serial-cccd-scanner/` because this is a new hardware/browser capability, not just a camera tuning tweak.

- `proposal.md`: why Web Serial is needed for CCCD
- `design.md`: browser permission model, page-scoped controller, fallback strategy
- `tasks.md`: implementation and verification checklist
- `specs/sample-management/spec.md`: requirements for first-time connect, auto-resume, UTF-8 fidelity, and fallback continuity

### 2. Browser-side serial helpers

Added `src/lib/qr/web-serial-cccd.ts` plus `src/lib/qr/web-serial-cccd.test.ts`.

Key behaviors:
- detect whether Web Serial is supported
- get previously granted ports with `getPorts()`
- decode UTF-8 correctly for Vietnamese accented characters
- normalize control separators to `|`
- emit payloads on newline or idle timeout when scanners do not send Enter

### 3. QR dialog serial UX

Updated `src/components/client-qr-scanner-dialog.tsx` plus dialog tests.

Key UX changes:
- new COM-port section for Web Serial status and actions
- explicit connect button for first-time browser permission
- connected/disconnecting/unsupported/error states in Vietnamese
- keyboard-style scanner input relabeled as fallback
- camera scanner remains in the same dialog

The dialog body now mounts only while open, so the keyboard buffer resets via remount instead of effect-driven state clearing.

### 4. Page-scoped controller integration

Added `src/hooks/use-cccd-serial-controller.ts` plus hook tests.

Key behaviors:
- page-owned controller for accession flow
- auto-resume granted port when the QR dialog becomes active
- explicit `requestPort()` only when no reusable port exists
- disconnect on dialog close, then reopen without manual reconnect if permission persists
- read-loop cleanup for reader lock and port closure

Wired the hook into `src/components/sample-accession-form.tsx` and added `src/components/__tests__/sample-accession-form-serial.test.tsx` to verify the form passes the controller into the QR dialog.

## Files Changed

- `openspec/changes/add-web-serial-cccd-scanner/design.md`
- `openspec/changes/add-web-serial-cccd-scanner/proposal.md`
- `openspec/changes/add-web-serial-cccd-scanner/specs/sample-management/spec.md`
- `openspec/changes/add-web-serial-cccd-scanner/tasks.md`
- `src/lib/qr/web-serial-cccd.ts`
- `src/lib/qr/web-serial-cccd.test.ts`
- `src/components/client-qr-scanner-dialog.tsx`
- `src/components/__tests__/client-qr-scanner-dialog.test.tsx`
- `src/hooks/use-cccd-serial-controller.ts`
- `src/hooks/use-cccd-serial-controller.test.tsx`
- `src/components/sample-accession-form.tsx`
- `src/components/__tests__/sample-accession-form-serial.test.tsx`

## Verification

### Focused tests

Command:

```bash
npx vitest run \
  src/lib/qr/web-serial-cccd.test.ts \
  src/components/__tests__/client-qr-scanner-dialog.test.tsx \
  src/hooks/use-cccd-serial-controller.test.tsx \
  src/components/__tests__/sample-accession-form-serial.test.tsx
```

Result:
- 4 test files passed
- 14 tests passed

### Typecheck

Command:

```bash
npm run typecheck
```

Result:
- passed

### Focused eslint

Command:

```bash
npx eslint \
  src/lib/qr/web-serial-cccd.ts \
  src/lib/qr/web-serial-cccd.test.ts \
  src/components/client-qr-scanner-dialog.tsx \
  src/components/__tests__/client-qr-scanner-dialog.test.tsx \
  src/hooks/use-cccd-serial-controller.ts \
  src/hooks/use-cccd-serial-controller.test.tsx \
  src/components/sample-accession-form.tsx \
  src/components/__tests__/sample-accession-form-serial.test.tsx
```

Result:
- passed
- non-blocking `baseline-browser-mapping` staleness notice from tooling output

### Production build

Command:

```bash
npm run build
```

Result:
- passed
- Next.js emitted existing non-blocking notices about `baseline-browser-mapping` staleness and `middleware` deprecation

## Manual Validation Still Needed

These require the real scanner and analyst workstation:

- HS-22 configured as `USB CDC` + `Original Data`
- first-time permission grant in Chrome/Edge
- reopen accession QR dialog and confirm auto-resume without chooser
- unplug/replug scanner and confirm recoverable reconnect behavior
- verify Vietnamese accented CCCD payload autofills client data correctly
- verify camera fallback still works on the same dialog
