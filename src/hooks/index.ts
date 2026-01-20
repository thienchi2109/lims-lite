/**
 * Custom React Hooks
 *
 * Barrel export for all custom hooks in the application.
 * Includes TanStack Query hooks for data fetching and mutations.
 */

// TanStack Query hooks for samples
export { useSamples } from './use-samples'
export { useSampleDetail } from './use-sample-detail'
export { useSampleTests } from './use-sample-tests'
export { useAssignTests } from './use-assign-tests'

// Approval queue
export { useApprovalCount } from './use-approval-count'

// Signature status
export { useSignatureStatus } from './use-signature-status'

// UI utilities
export { useFaviconBadge } from './use-favicon-badge'
