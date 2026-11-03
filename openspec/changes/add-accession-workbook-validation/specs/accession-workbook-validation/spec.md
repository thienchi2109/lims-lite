## ADDED Requirements

### Requirement: Reject hostile archives before semantic output

The parser MUST enforce actual original XLSX bytes strictly below 10,000,000 decimal bytes and fail closed on corrupt ZIP headers/directories/descriptors/CRC, encryption, unsupported packaging and actual inflation/resource exhaustion. It SHALL require server-owned defensive resource ceilings and SHALL NOT impose business row-count caps.

#### Scenario: Decimal boundary
- **WHEN** actual original byte lengths are 9,999,999, 10,000,000 and 10,000,001
- **THEN** only the first passes the size guard and still undergoes all archive/workbook checks

#### Scenario: Bomb or corrupt archive
- **WHEN** actual expanded bytes exceed the budget or ZIP local/central/CRC records disagree
- **THEN** the parser returns only a safe Vietnamese error and no partial rows

#### Scenario: Historical count cap exceeded
- **WHEN** an otherwise valid workbook exceeds a former prototype business count but satisfies current byte/resource guards
- **THEN** validation processes every row, including a final invalid cell, without truncation

### Requirement: Validate exact literal-text template and authenticated authority

The parser SHALL enforce the exact eight visible v1 sheets/columns/headers in arbitrary worksheet order and TASK-8 authenticated metadata/catalog verifier. It MUST parse namespace-aware XML without DTD/custom entities or formula evaluation, accept predefined/numeric character references and literal shared/inline/rich text, inspect all cells including hidden/filtered rows and reject unsupported constructs under #112 section 7.

#### Scenario: Values remain literal
- **WHEN** text includes leading zeros, Vietnamese decomposed Unicode, whitespace or an ISO date
- **THEN** trim/NFC/null normalization preserves zeros and signs, and only real ISO dates in 1900–2100 are accepted

#### Scenario: Unsafe workbook feature
- **WHEN** any sheet includes a formula/cached formula, nontext cell, hidden sheet, external link, macro, unexpected part/name, merge in structural/data areas or out-of-column cell
- **THEN** the whole workbook is rejected with real coordinates where available

#### Scenario: Safe presentation and dropdown constructs
- **WHEN** worksheets are reordered, business rows are hidden/filtered, and dropdowns use static internal catalog ranges with matching defined names
- **THEN** the parser accepts the safe presentation constructs, validates all hidden/filtered business rows and reports errors in deterministic contract-sheet/row/column/code order

#### Scenario: Metadata or catalog changed
- **WHEN** descriptor authentication, literal metadata/catalog integrity or current authority verification fails
- **THEN** no catalog code is trusted and the parser returns the appropriate template/catalog error

### Requirement: Return complete structural result without writes

The parser SHALL validate case-sensitive references, syntax, all duplicate definitions/pairs, orphans, catalog compatibility, required fields, typed identity and supplied optional fields. It SHALL return either typed in-memory rows or all independent Vietnamese errors with stable codes, real coordinates, related duplicate locations and deterministic ordering. It MUST NOT match identities, require missing create-only phone/gender before TASK-10 resolution, write business data, retain payload/workbook or log profile values.

#### Scenario: Independent errors and no partial success
- **WHEN** early rows are valid but a late cell and independent references are invalid
- **THEN** the result contains all independent errors and no validated partial payload

#### Scenario: Identity resolution belongs to the consumer
- **WHEN** two clients have the same name/date of birth, or supplied phone/gender are absent
- **THEN** TASK-9 does not infer duplicate identity or create-only missing fields; TASK-10 applies canonical resolution and create validation
