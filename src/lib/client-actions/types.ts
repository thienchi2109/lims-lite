export type ClientActionName =
    | 'getSamples'
    | 'assignTests'
    | 'updateSample'
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

export interface ClientActionRequest {
    action: ClientActionName
    payload?: unknown
}
