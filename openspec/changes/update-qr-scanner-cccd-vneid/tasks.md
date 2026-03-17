## 1. Scanner configuration hardening

- [ ] 1.1 Add `Html5Qrcode` constructor config for QR-only formats and explicit BarcodeDetector preference.
- [ ] 1.2 Replace current camera start config with tuned defaults for CCCD/VNeID (`fps`, `qrbox`, `disableFlip`, `videoConstraints`).
- [ ] 1.3 Implement safe fallback path when requested camera constraints are unsupported or downgraded.

## 2. Capability-aware runtime tuning

- [ ] 2.1 Read running track capabilities/settings after scanner start.
- [ ] 2.2 Apply best-effort runtime constraints (`zoom`, `torch`, focus-related constraints) only when supported.
- [ ] 2.3 Guard unsupported APIs/platforms without breaking scanning flow.

## 3. Operational UX and fallback continuity

- [ ] 3.1 Preserve and verify USB/Bluetooth scanner flow in the same dialog.
- [ ] 3.2 Add non-blocking Vietnamese guidance for hard-to-scan conditions (distance/light/steady camera).
- [ ] 3.3 Ensure decode success still auto-closes scanner and keeps current business flow unchanged.

## 4. Observability and verification

- [ ] 4.1 Add scan quality instrumentation (time-to-first-decode, decoder source, success/failure reason buckets).
- [ ] 4.2 Add/update test checklist for CCCD/VNeID cases (small QR, dense QR, low light, mobile).
- [ ] 4.3 Run validation gates (`npm run typecheck`, `npm run lint`, manual accession QR regression).
