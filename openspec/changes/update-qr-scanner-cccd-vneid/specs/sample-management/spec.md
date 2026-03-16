## ADDED Requirements

### Requirement: Optimized camera scan profile for CCCD/VNeID

The system SHALL apply an optimized `html5-qrcode` camera configuration profile for CCCD/VNeID scanning in the accession QR dialog to improve decoding of small, high-density QR codes.

#### Scenario: Balanced profile is applied on scanner start

- **GIVEN** an authenticated analyst opens the CCCD QR scanner dialog in accession flow  
- **WHEN** camera scanning is initialized  
- **THEN** the scanner SHALL start with a tuned profile including:
  - QR-focused decode configuration
  - Tuned `fps` and `qrbox` values for dense QR reliability
  - `disableFlip` enabled for back-camera workflow
  - HD-oriented `videoConstraints` with non-strict preference semantics

#### Scenario: Device cannot satisfy preferred camera constraints

- **GIVEN** a device/browser cannot satisfy one or more preferred camera constraints  
- **WHEN** scanner startup applies the profile  
- **THEN** the system SHALL continue scanning with supported settings instead of hard-failing  
- **AND** the UI SHALL show non-blocking guidance in Vietnamese for improving scan conditions or using hardware scanner fallback.

### Requirement: Capability-aware runtime camera tuning

The system SHALL apply best-effort runtime camera enhancements based on supported track capabilities without breaking unsupported platforms.

#### Scenario: Runtime capabilities are available

- **GIVEN** camera scanning is running and capability APIs are available  
- **WHEN** the system reads running track capabilities/settings  
- **THEN** the system SHALL apply supported enhancements (such as zoom/torch/focus-related constraints) through runtime constraints APIs  
- **AND** keep scanning active during these adjustments.

#### Scenario: Runtime capabilities are unavailable

- **GIVEN** camera capability APIs or specific camera features are unsupported  
- **WHEN** runtime tuning is attempted  
- **THEN** the system SHALL skip unsupported adjustments safely  
- **AND** scanning SHALL continue with baseline profile behavior.

### Requirement: QR scan observability and operational continuity

The system SHALL preserve operational continuity while collecting scan quality signals to evaluate and improve CCCD/VNeID scan performance.

#### Scenario: Decode success and fallback continuity

- **GIVEN** a user scans CCCD/VNeID in the accession dialog  
- **WHEN** camera decode succeeds  
- **THEN** the scanner SHALL preserve current success flow (auto-handoff to parsing/business logic)  
- **AND** fallback input paths (USB/Bluetooth scanner input) SHALL remain available and unaffected.

#### Scenario: Scan quality telemetry is recorded

- **GIVEN** a scan session runs in the accession workflow  
- **WHEN** decode attempts occur  
- **THEN** the system SHALL capture scan quality signals including:
  - time-to-first-decode
  - decoder source information
  - categorized failure outcomes  
- **AND** this data SHALL be usable for baseline-vs-optimized rollout comparison.
