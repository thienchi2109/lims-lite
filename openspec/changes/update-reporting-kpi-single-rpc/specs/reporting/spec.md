## ADDED Requirements

### Requirement: Consolidated KPI Retrieval

The system SHALL retrieve the Reports dashboard KPI-card payload through a single consolidated backend aggregation for the requested date range, while preserving the existing KPI calculations, role-based access rules, and `KPIMetrics` contract consumed by the application.

#### Scenario: Reports dashboard requests KPI cards

- **GIVEN** an authenticated Manager or Analyst is viewing the Reports dashboard with a selected date range
- **WHEN** the application requests KPI-card data
- **THEN** the system retrieves one consolidated KPI payload for that date range
- **AND** the payload includes average TAT, status breakdown, pending approvals, on-time delivery rate, and error rate
- **AND** each KPI card continues to use the existing metric definitions already specified for the reporting dashboard

#### Scenario: Existing KPI consumers keep their contract

- **GIVEN** the server-side consumers `getKPIMetrics()` and `fetchKPIData()`
- **WHEN** they map the consolidated KPI payload for the Reports dashboard
- **THEN** they return the existing `KPIMetrics` structure
- **AND** no Reports page or KPI-card component changes are required to consume the data

#### Scenario: Consolidated KPI retrieval fails

- **GIVEN** the consolidated KPI aggregation cannot be executed successfully
- **WHEN** a Reports dashboard consumer requests KPI data
- **THEN** the system returns an error instead of partial KPI-card data
