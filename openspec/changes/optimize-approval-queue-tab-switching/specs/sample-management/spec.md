## ADDED Requirements

### Requirement: Manager approval queue tab switching SHALL use cached TanStack Query state

The system SHALL load manager approval queue rows for `review` and `completed` through TanStack Query query keys that include the active tab, so switching tabs can reuse cached data instead of forcing a full route refresh for the queue list.

#### Scenario: Switching back to a previously loaded tab reuses cached rows

- **WHEN** a manager has already loaded both approval queue tabs in the current session
- **THEN** switching back to a previously viewed tab SHALL render cached rows immediately
- **AND** the system SHALL allow a background refetch without blanking the queue list
- **AND** the tab switch SHALL NOT depend on a full server route navigation just to show the list for the target tab

#### Scenario: The opposite tab is prefetched on likely intent

- **WHEN** a manager lands on the approval queue or signals intent to open the opposite tab
- **THEN** the system SHALL prefetch the opposite tab queue using a distinct approval queue query key
- **AND** the next tab switch SHALL reuse that prefetched data when it is still fresh

#### Scenario: Deep-link tab state survives hydration and refresh

- **WHEN** a manager opens `/manager/approvals?tab=completed` directly or refreshes that URL
- **THEN** the system SHALL hydrate the `completed` queue on initial load
- **AND** subsequent client-side tab switches SHALL keep the `tab` query parameter synchronized with the active tab

#### Scenario: Switching tabs clears stale sample selection

- **WHEN** a manager switches to a different approval tab and the current `sampleId` does not exist in that tab's queue
- **THEN** the system SHALL clear `sampleId` from the URL
- **AND** the system SHALL clear the related detail state instead of keeping a sample outside the active queue
- **AND** desktop and mobile SHALL apply the same rule

#### Scenario: Desktop and mobile preserve the same tab semantics

- **WHEN** a manager switches approval queue tabs on desktop or mobile breakpoint
- **THEN** the system SHALL apply the same rules for URL synchronization, cached queue reuse, and empty/error states
- **AND** breakpoint changes SHALL NOT introduce a different tab selection contract for the same URL

#### Scenario: Hidden layout does not duplicate queue side effects

- **WHEN** the approval page renders responsive desktop/mobile layouts around the same URL
- **THEN** only the viewport-active queue owner SHALL drive approval queue query, prefetch, and tab URL synchronization side effects
- **AND** hidden layouts SHALL NOT trigger duplicate fetch/prefetch behavior for the same tab switch

#### Scenario: Fetch failure is isolated to the active tab

- **WHEN** loading the active approval tab fails
- **THEN** the system SHALL show a Vietnamese error state for that tab
- **AND** the system SHALL preserve cached rows for the other tab until that tab is opened
