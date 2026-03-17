## Why

- Current camera QR scanning works, but it is unreliable for small, high-density payloads commonly seen on Vietnamese CCCD/VNeID QR codes.
- Research identified practical bottlenecks: non-optimized camera constraints, broad format scanning, unnecessary flip pass cost, and missing capability-aware runtime tuning.
- This causes slower scan success, inconsistent field operations, and frequent fallback to manual entry.

## What Changes

- Define an optimized `html5-qrcode` scanning profile for CCCD/VNeID in the accession QR dialog:
  - Prefer QR-only decoding formats.
  - Use tuned `fps`, `qrbox`, and `disableFlip` defaults for camera-back workflows.
  - Apply HD-oriented `videoConstraints` with safe fallback behavior.
- Add capability-aware runtime tuning:
  - Read track capabilities/settings.
  - Apply best-effort zoom/torch/focus constraints only when supported.
- Add operational resilience:
  - Keep USB/Bluetooth scanner path as first-class fallback.
  - Show non-blocking guidance when camera constraints downgrade or decode quality is poor.
- Add observability and verification:
  - Capture scan quality signals (time-to-first-decode, decoder source, success/failure categories).
  - Add regression test checklist focused on CCCD/VNeID scenarios and low-light/mobile devices.

## Impact

- **Affected specs:** `sample-management`
- **Affected code (planned):**
  - `src/components/qr-scanner.tsx`
  - `src/components/client-qr-scanner-dialog.tsx`
  - Related docs/tests for accession QR workflow
- **Behavioral impact:** Improves reliability for difficult QR codes while preserving existing fallback flows.
- **Compliance/Risk:** No schema/RLS changes; no hard-delete behavior; Vietnamese UI remains intact.
