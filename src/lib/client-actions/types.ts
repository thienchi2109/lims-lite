export type ClientActionName =
    | 'getSamples'
    | 'assignTests'
    | 'updateSample'
    | 'createSample'
    | 'accessionAndAssignTests'
    | 'getSampleTests'
    | 'getResultsBySample'
    | 'saveBatchResults'
    | 'submitSampleForReview'
    | 'getAssayDefinitions'
    | 'getMethods'
    | 'addMethodToAssay'
    | 'setDefaultMethod'
    | 'removeMethodFromAssay'
    | 'createAssayDefinition'
    | 'updateAssayDefinition'
    | 'deleteAssayDefinition'
    | 'approveResults'
    | 'cancelApproval'
    | 'createUser'
    | 'updateUser'
    | 'deleteUser'
    | 'rejectSample'
    | 'discardSample'

export interface ClientActionRequest {
    action: ClientActionName
    payload?: unknown
}
