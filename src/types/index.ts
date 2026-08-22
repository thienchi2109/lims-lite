// ============================================================================
// BARREL EXPORT - All types re-exported for backward compatibility
// ============================================================================

// Core types: enums, user, client, auth, pagination, audit
export * from './core'

// Lab types: assay, method, sample, result, validation
export * from './lab'

// Workflow types: approval, signatures, CoA
export * from './workflow'
export * from './approval-batch'

// Result review types: manual assessments and submission payloads
export * from './result-review'

// Assay/sample-type compatibility catalog contracts
export * from './assay-sample-type-compatibility'

// Audited client lifecycle and manager adjudication contracts
export * from './client-lifecycle'

// Analytics types: search, reports, dashboard
export * from './analytics'

// QC types: Westgard rules, sessions, materials, definitions
export * from './qc'
