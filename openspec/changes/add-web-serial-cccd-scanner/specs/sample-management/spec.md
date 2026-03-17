## ADDED Requirements

### Requirement: Analyst accession supports Web Serial CCCD scanners

The system SHALL support reading CCCD scanner payloads from a granted Web Serial port in the analyst accession workflow when the browser environment supports the Web Serial API.

#### Scenario: First-time connection requires explicit user consent

- **GIVEN** an analyst is using a supported Chromium browser on a secure origin
- **WHEN** no serial port has been granted to the application yet
- **THEN** the CCCD scanner dialog SHALL require an explicit user action to request a port
- **AND** the browser port chooser SHALL be triggered through that user action instead of automatically.

#### Scenario: Previously granted port is resumed

- **GIVEN** an analyst has previously granted a compatible scanner port to the application
- **WHEN** the analyst opens the CCCD scanner dialog again in a later page session
- **THEN** the system SHALL attempt to discover and reopen the granted port without showing the browser chooser first
- **AND** only fall back to a manual reconnect action if no reusable port is available.

### Requirement: Web Serial scanner payloads preserve CCCD text fidelity

The system SHALL decode raw CCCD scanner bytes as UTF-8 and emit a sanitized payload string that preserves Vietnamese accented characters for existing QR parsing logic.

#### Scenario: UTF-8 CCCD payload is read from COM port

- **GIVEN** the scanner is configured in USB CDC mode with original/raw data output
- **WHEN** the device sends a CCCD payload containing Vietnamese accented characters
- **THEN** the system SHALL decode the payload without degrading the characters
- **AND** hand the resulting string to the existing CCCD parsing and client lookup flow.

#### Scenario: Scanner framing varies

- **GIVEN** the device may or may not send a terminating Enter/newline after the payload
- **WHEN** the payload is read from the serial stream
- **THEN** the system SHALL emit the payload when a line terminator is received
- **AND** SHALL also emit the payload after a short idle interval if no terminator arrives.

### Requirement: Serial support preserves accession fallback continuity

The system SHALL keep the existing accession QR workflow operational when Web Serial is unavailable, unsupported, or disconnected.

#### Scenario: Browser does not support Web Serial

- **GIVEN** the analyst opens the CCCD scanner dialog in an unsupported browser or insecure context
- **WHEN** Web Serial is unavailable
- **THEN** the system SHALL present a non-blocking Vietnamese explanation
- **AND** camera scanning plus keyboard fallback input SHALL remain usable.

#### Scenario: Serial connection fails during use

- **GIVEN** the analyst is using the CCCD scanner dialog
- **WHEN** the serial device disconnects or the stream errors
- **THEN** the system SHALL surface a recoverable error state
- **AND** keep camera scanning plus keyboard fallback input available without reloading the page.
