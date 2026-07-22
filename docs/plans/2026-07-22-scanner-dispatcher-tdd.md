# Scanner Dispatcher for Virtual COM - TDD Implementation Plan

**Date:** 2026-07-22  
**Repository:** `/root/lims-lite`  
**Implementation branch:** `feat/scanner-dispatcher` from the latest `main`  
**Database impact:** none

## Goal

Use one persistent Web Serial connection for the scanner in Virtual COM mode,
then route each completed frame to the correct active workflow:

- Vietnamese CCCD QR scan during sample accession.
- Sample barcode scan on `/samples`.
- Sample barcode scan while Global Search is open.

The current camera and keyboard fallback flows must remain available.

## Locked Decisions

1. Mount one `ScannerSerialProvider` inside the authenticated dashboard layout.
2. Automatically reopen a previously granted port after authentication.
3. Use a shared connection control in the dashboard header when explicit browser
   permission or reconnection is required.
4. Classify frames in this order:
   - `identity-qr` when `parseClientIdentityQr()` succeeds.
   - `sample-code` when the value matches the internal sample ID format.
   - `unknown` otherwise.
5. A sample code must match `^CDC-XN-\d{8}-\d{4,}$`, with a valid
   `DDMMYYYY` date.
6. Consumer priority:
   - CCCD dialog: `300`
   - Open Global Search: `200`
   - Mounted `/samples` filters: `100`
7. One frame is delivered to at most one consumer. Equal priorities use the
   most recently activated consumer.
8. Sample scans search immediately. Manual typing keeps the existing debounce.
9. Scanning does not automatically navigate to a result.
10. Raw CCCD data must not be broadcast, persisted, rendered in errors, or
    written to logs.

## Target Interfaces

```ts
export type ScannerEvent =
    | {
        kind: 'identity-qr'
        identity: ParsedClientIdentityQr
    }
    | {
        kind: 'sample-code'
        code: string
    }
    | {
        kind: 'unknown'
    }
```

```ts
useScannerConsumer({
    enabled,
    kinds,
    priority,
    onEvent,
})
```

The shared connection context exposes:

```ts
type ScannerConnectionState =
    | 'unsupported'
    | 'permission_required'
    | 'connecting'
    | 'connected'
    | 'error'

type ScannerConnection = {
    state: ScannerConnectionState
    error: string | null
    connect: () => Promise<void>
    disconnect: () => Promise<void>
}
```

The `/samples` filter handlers gain:

```ts
commitSearch: (value: string) => void
```

`commitSearch()` updates the visible value and query immediately, resets
`page=1`, preserves unrelated filters, and suppresses the matching delayed
debounce update.

---

## Phase 1 - Scanner Core

### Purpose

Generalize the existing CCCD-specific byte transport, add the typed classifier,
and add the priority dispatcher as pure, independently tested modules.

### Main files

- Create `src/lib/scanner/web-serial-scanner.ts`
- Create `src/lib/scanner/scanner-event.ts`
- Create `src/lib/scanner/classify-scanner-payload.ts`
- Create `src/lib/scanner/scanner-dispatcher.ts`
- Replace the corresponding CCCD-specific transport tests after callers migrate

### RED

Write tests first for:

- UTF-8 Vietnamese data split across byte chunks.
- CR/LF framing and 120 ms idle framing.
- Decoder reset dropping an incomplete frame.
- Valid CCCD classification without exposing the raw frame.
- Valid `CDC-XN-DDMMYYYY-NNNN` classification.
- Invalid dates, lowercase IDs, arbitrary alphanumeric values, and malformed
  pipe payloads becoming `unknown`.
- Highest-priority eligible consumer winning.
- Most recently activated consumer winning an equal-priority tie.
- Unregister, no-consumer, synchronous failure, and asynchronous rejection.
- One event never reaching multiple consumers.

Run:

```bash
rtk npm run test:run -- src/lib/scanner
```

Expected RED: the scanner modules do not exist.

### GREEN

- Preserve baud rate `9600`, streaming UTF-8 decoding, control-separator
  normalization, and current frame timing.
- Keep transport unaware of payload meaning.
- Call `parseClientIdentityQr()` before checking the sample-code format.
- Return `unknown` without including the rejected payload.
- Keep the dispatcher registry private and deterministic.
- Catch consumer failures outside the serial reader without logging payload
  content.

### Exit criteria

- Scanner core is framework-independent.
- Existing decoder behavior has equivalent regression coverage.
- All Phase 1 tests pass.

### Commit checkpoint

```text
feat: Add scanner payload dispatcher core
```

---

## Phase 2 - Persistent Provider and Header Control

### Purpose

Move ownership of the serial port from the accession page to one authenticated,
route-persistent provider and expose connection recovery in the header.

### Main files

- Create `src/components/scanner/scanner-serial-provider.tsx`
- Create `src/components/scanner/use-scanner.ts`
- Create `src/components/scanner/scanner-connection-button.tsx`
- Modify `src/app/(dashboard)/layout.tsx`
- Modify `src/components/dashboard-header.tsx`
- Retire `src/hooks/use-cccd-serial-controller.ts` after Phase 3

### RED

Port the existing serial-controller lifecycle tests and add coverage for:

- Auto-resuming one granted port on authenticated provider mount.
- Never calling `requestPort()` during automatic resume.
- Requesting a port only through explicit `connect()`.
- Keeping the port open while consumers and routes change.
- Classifying and dispatching completed frames.
- Recoverable stream errors and no retry loop when a port is busy.
- Reader cancellation, lock release, port close, and partial-frame discard.
- Cleanup on logout, provider unmount, or `principalKey` change.
- No provider in the unauthenticated layout branch.
- Header states: connect, reconnect, connecting, connected/disconnect, and
  unsupported.

Expected RED: connection ownership is still page-scoped.

### GREEN

- Provider owns the port, reader, decoder, classifier, and dispatcher.
- Attempt `getPorts()` once after authenticated mount.
- Do not add local storage or automatic retry timers.
- Mount the provider inside `AuthenticatedQueryBoundary` and key it with
  `dashboardSession.principalKey`.
- Render the scanner control in desktop and mobile header actions for all roles.
- Use the existing Plug/Unplug icon language, accessible labels, and Vietnamese
  tooltips.
- Keep Global Search hidden for doctors as it is today.

### Verify

```bash
rtk npm run test:run -- \
  src/components/scanner \
  src/components/__tests__/dashboard-header-doctor.test.tsx
```

### Exit criteria

- Exactly one serial reader exists in the authenticated React tree.
- Route changes retain the connection.
- Logout and principal changes release it.
- Users can grant or recover COM access from the header.

### Commit checkpoint

```text
feat: Add persistent scanner serial provider
```

---

## Phase 3 - Migrate the CCCD Flow

### Purpose

Route serial CCCD scans through the provider without changing the working
camera, keyboard, client lookup, or administrative autofill behavior.

### Main files

- Modify `src/components/sample-accession-form.tsx`
- Modify `src/components/client-qr-scanner-dialog.tsx`
- Rewrite `src/components/__tests__/sample-accession-form-serial.test.tsx`
- Update `src/components/__tests__/client-qr-scanner-dialog.test.tsx`

### RED

Replace the obsolete page-controller assertion with tests proving:

- The CCCD consumer is registered only while its dialog is open.
- It accepts `identity-qr` and `unknown` at priority `300`.
- A serial identity event runs the existing lookup/autofill path exactly once.
- The dialog closes after a valid identity scan.
- `unknown` keeps the existing Vietnamese invalid-QR feedback.
- Camera scanning still works while serial is disconnected.
- Keyboard fallback still works when Web Serial is unsupported.

Expected RED: accession still creates its own controller and expects raw serial
payloads.

### GREEN

- Extract post-parse identity handling into a callback accepting
  `ParsedClientIdentityQr`.
- Camera and keyboard inputs continue parsing their raw text locally.
- Serial identity events call the parsed callback directly.
- Serial `unknown` closes the dialog and shows the existing error.
- Reuse the shared connection API for the dialog's connect/disconnect controls.
- Remove the page-owned controller after all CCCD tests are green.
- Keep `sample-accession-form.tsx` near its current 350-line limit by extracting
  scanner registration rather than expanding the form.

### Verify

```bash
rtk npm run test:run -- \
  src/components/__tests__/sample-accession-form-serial.test.tsx \
  src/components/__tests__/sample-accession-form.test.tsx \
  src/components/__tests__/client-qr-scanner-dialog.test.tsx
```

### Exit criteria

- Vietnamese CCCD scans still fill administrative data correctly.
- Invalid scan behavior is preserved.
- Camera and keyboard fallback behavior is unchanged.
- No accession-owned serial reader remains.

### Commit checkpoint

```text
refactor: Route CCCD scans through dispatcher
```

---

## Phase 4 - Route Sample Barcodes

### Purpose

Connect sample barcode events to `/samples` and Global Search while preserving
their manual-input behavior and enforcing the agreed priority.

### Main files

- Modify `src/components/sample-filters/use-filter-params.ts`
- Modify `src/components/sample-filters/index.tsx`
- Modify `src/components/global-search.tsx`
- Add focused serial integration tests for both search surfaces

### RED - `/samples`

Add tests proving:

- `commitSearch()` updates the visible value and query immediately.
- One committed scan creates exactly one query update.
- Page resets to 1 while other filters, sort, and page size remain intact.
- Manual `setSearch()` remains debounced at 250 ms.
- `SampleFilters` registers a `sample-code` consumer at priority `100`.
- CCCD and unknown events are ignored.
- The existing camera sample scan uses the same immediate commit path.

### RED - Global Search

Add tests proving:

- No consumer is registered while the command dialog is closed.
- Opening it registers `sample-code` at priority `200`.
- A scan updates `query` and `debouncedQuery` immediately.
- The dialog stays open and no automatic navigation occurs.
- Closing the dialog unregisters the consumer.
- An open Global Search wins over `/samples`.
- Only the Global Search instance that is actually open receives the event.

Expected RED: both search surfaces only react to their own input handlers.

### GREEN

- Add `commitSearch()` and suppress only the corresponding delayed update.
- Register the `/samples` consumer for the lifetime of `SampleFilters`.
- Use `commitSearch(event.code)` for serial and camera sample scans.
- Register Global Search only while `open === true`.
- Set both Global Search query states for immediate fetching.
- Let priority resolve conflicts; do not couple the two components directly.

### Verify

```bash
rtk npm run test:run -- \
  src/components/sample-filters/use-filter-params.test.tsx \
  src/components/__tests__/sample-filters-scope.test.tsx \
  src/components/__tests__/sample-filters-serial.test.tsx \
  src/components/__tests__/global-search-serial.test.tsx
```

### Exit criteria

- Serial barcode search is immediate on both surfaces.
- Manual typing remains debounced.
- Global Search wins only while open.
- One scan produces one search transition and no automatic navigation.

### Commit checkpoint

```text
feat: Route sample barcodes to search
```

---

## Phase 5 - Integration, Review, and Acceptance

### Purpose

Verify the complete flow, remove compatibility code, and prepare a reviewable
feature branch.

### Automated scenarios

Confirm:

1. One decoder frame creates one typed event.
2. CCCD events cannot reach sample search consumers.
3. Sample events reach Global Search while it is open.
4. Sample events return to `/samples` after Global Search closes.
5. Unknown frames reach neither sample search surface.
6. Mount/unmount and reconnect do not duplicate registrations.
7. Consumer failures do not terminate the read loop.
8. Raw CCCD data is absent from errors, logs, and rendered UI.

### Cleanup

- Remove obsolete CCCD-specific transport aliases and controller files.
- Keep application/test files focused and near the project's 250-350-line
  target.
- Run GitNexus change detection and inspect dashboard, accession, and search
  blast radius.
- Do not change database migrations or barcode-label geometry.

### Quality gates

```bash
rtk npm run test:run
rtk npm run typecheck
rtk npm run react-doctor:diff
rtk npm run build
rtk git diff --check
```

All commands must pass before merge.

### Physical scanner acceptance

Use Chromium in a secure context with the real Virtual COM scanner:

1. Connect from the header.
2. Change routes and confirm the connection persists.
3. Scan a Vietnamese CCCD during accession and verify autofill.
4. Scan a printed sample barcode on `/samples` and verify immediate filtering.
5. Open Global Search on `/samples`, scan again, and verify only Global Search
   changes.
6. Close Global Search and verify scanning returns to `/samples`.
7. Disconnect/reconnect, unplug/replug, and test a second tab holding the port.
8. Confirm all failures remain recoverable without retry loops.
9. Confirm camera and keyboard fallback scanning still works.
10. Confirm no raw CCCD payload appears in the browser console.

### Exit criteria

- Automated and physical acceptance checks pass.
- Each implementation phase ends in a green, reviewable commit.
- The feature branch is rebased, pushed, reviewed, and merged through the normal
  non-hotfix workflow.

### Final commit checkpoint

Use only when Phase 5 adds test or cleanup changes:

```text
test: Verify scanner dispatcher workflows
```

## Dependencies

```text
Phase 1 -> Phase 2 -> Phase 3
                    -> Phase 4
Phase 3 + Phase 4 -> Phase 5
```

Phases 3 and 4 may be implemented independently after the provider is green,
but should be reviewed in order so CCCD regressions are resolved before sample
search behavior is enabled.

## Non-Goals

- Supporting HID Keyboard mode for the physical scanner.
- Accepting legacy or arbitrary sample-code formats.
- Automatically opening sample details after scanning.
- Broadcasting scans through DOM events or a generic global event bus.
- Persisting scan history.
- Logging raw CCCD or barcode contents.
- Adding non-Chromium Web Serial support.
- Deploying or operating production services from this workspace.
