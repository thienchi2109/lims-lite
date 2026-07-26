export function isBackgroundBatchResultApprovalEnabled(
    env: NodeJS.ProcessEnv = process.env,
) {
    return env.BACKGROUND_BATCH_RESULT_APPROVAL_ENABLED === 'TRUE'
}
