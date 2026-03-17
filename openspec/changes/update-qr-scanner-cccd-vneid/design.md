## Context

The accession workflow already supports camera QR scanning and USB/Bluetooth scanner input in one dialog. However, field usage shows unstable decoding for small and dense CCCD/VNeID QR codes, especially on mobile devices and low-light conditions. Internal research confirmed that current scanner setup does not yet apply high-detail camera constraints and does not actively tune runtime camera capabilities.

The proposal must improve scan reliability without changing domain data model, RLS policies, or existing client parsing contract.

## Goals / Non-Goals

- Goals:
  - Improve first-pass decode reliability for CCCD/VNeID QR codes.
  - Reduce scan latency variance on common mobile hardware.
  - Preserve existing fallback behavior (USB/Bluetooth/manual flow).
  - Add measurable diagnostics to evaluate rollout impact.
- Non-Goals:
  - Replace `html5-qrcode` library.
  - Introduce new DB schema or migration changes.
  - Redesign accession business workflow.

## Decisions

- Decision: Use a tuned default camera profile (Balanced) and keep behavior-safe fallbacks.
  - Rationale: Provides immediate reliability gains without forcing strict constraints that can fail on older devices.
- Decision: Restrict decode target to QR format in constructor config.
  - Rationale: Reduces decoder search space and CPU cost for the specific CCCD/VNeID use case.
- Decision: Apply capability-aware runtime constraints only when supported.
  - Rationale: Device heterogeneity is high; best-effort adaptation avoids scanner startup regressions.
- Decision: Keep BarcodeDetector preference explicit but monitor decoder source.
  - Rationale: Runtime decoder behavior differs across browsers/devices; telemetry is required for evidence-based tuning.

## Risks / Trade-offs

- Lowering scanner `fps` improves per-frame decode time but can feel less responsive if set too low.
- Aggressive camera constraints can produce startup failures on weaker devices if not guarded.
- Additional instrumentation may add implementation complexity; must remain lightweight and privacy-safe.

## Migration Plan

1. Implement balanced profile and capability guards behind incremental PR.
2. Validate on targeted manual matrix (CCCD card, VNeID screen, small/dense QR, low light).
3. Compare baseline vs new profile using scan quality metrics.
4. Keep fallback path unchanged throughout rollout.

## Open Questions

- None blocking for proposal stage. Device-specific threshold tuning (exact `fps`/`qrbox` bounds) will be finalized during implementation validation.
