## Why

- CCCD QR payloads contain Vietnamese accented text that handheld scanners can fail to emit correctly in USB keyboard mode because device-side keyboard encoding is lossy.
- Field troubleshooting confirmed that HS-22 scanners work reliably when configured as USB CDC with `Original Data`, which requires the web app to read raw bytes from a COM port instead of relying on text typed into a focused input.
- Analysts need a lower-friction CCCD scan workflow on Windows Chrome/Edge while preserving existing camera and keyboard fallback paths.

## What Changes

- Add a Web Serial-based CCCD scanner flow for analyst accession on Chromium desktop browsers.
- Introduce a page-scoped serial connection controller that:
  - requests first-time port permission from an explicit user click,
  - resumes previously granted ports with `navigator.serial.getPorts()` when available,
  - keeps the connection reusable across dialog open/close during the analyst session.
- Extend the CCCD QR dialog to expose Web Serial connection state and use camera plus keyboard input as fallback paths.
- Preserve the existing QR parsing and client lookup flow by continuing to hand off a decoded payload string to current business logic.

## Impact

- **Affected specs:** `sample-management`
- **Affected code:** analyst accession QR dialog, accession form state management, new browser-side serial reader module, focused tests/docs
- **Behavioral impact:** adds a new preferred hardware path for CCCD scanning on supported desktop browsers; camera and keyboard fallback remain available
- **Compliance/Risk:** no schema or RLS changes; no raw payload persistence; browser permission prompts remain explicit and user-driven
