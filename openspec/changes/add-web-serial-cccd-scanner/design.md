## Context

The current accession QR dialog supports camera scanning and keyboard-style scanner input. CCCD payloads can be decoded successfully by hardware scanners yet fail during keyboard output because the scanner firmware cannot encode Vietnamese accented characters in its keyboard-emulation mode. A working field configuration already exists: USB CDC + raw/original data output.

The application therefore needs a browser-side serial integration that reads raw bytes from a granted COM port, decodes UTF-8 safely, frames payloads predictably, and hands the resulting string to the existing CCCD parser.

## Goals / Non-Goals

- Goals:
  - Support CCCD scanner input over Web Serial on Windows Chrome/Edge.
  - Require first-time browser permission only when necessary and reuse granted ports when possible.
  - Keep accession business logic unchanged after a payload string is received.
  - Preserve camera and keyboard fallback paths.
- Non-Goals:
  - Replace camera-based QR scanning.
  - Support non-Chromium browsers with custom polyfills or native helpers.
  - Persist raw CCCD payloads to the server or database.

## Decisions

- Decision: Use a page-scoped serial controller owned by the accession form.
  - Rationale: this keeps a session-persistent port connection without turning the shared dialog into a global state owner.
- Decision: Keep the dialog contract centered on `onScan(decodedText)`.
  - Rationale: downstream parsing, client lookup, and auto-fill behavior already work and should not be duplicated.
- Decision: Treat `navigator.serial.requestPort()` as a first-time explicit action and `navigator.serial.getPorts()` as the preferred resume path.
  - Rationale: aligns with browser security constraints while reducing reconnect friction.
- Decision: Decode bytes as UTF-8 and emit a payload when a line terminator arrives or a short idle timeout indicates end-of-scan.
  - Rationale: scanner framing behavior is device-dependent and must remain robust even if Enter is not sent.

## Risks / Trade-offs

- Browser/device support is limited to secure-context Chromium desktop environments.
- Port selection can still require operator intervention if permissions are revoked, COM assignments change, or the device is replugged.
- Serial lifecycle bugs can leak reader locks or duplicate scans if cleanup is sloppy; tests must exercise reconnect and framing behavior.

## Migration Plan

1. Add OpenSpec requirements and focused tests for serial support.
2. Implement serial read/decode/framing logic behind a browser capability check.
3. Wire the dialog and accession page to reuse a granted port throughout a session.
4. Verify camera and keyboard fallback still behave correctly.
