'use server'

/**
 * QC Setup - Barrel file for QC-related server actions
 *
 * This file re-exports all QC functionality from focused modules:
 * - qc-materials.ts: CRUD for control materials + pagination/filtering
 * - qc-definitions.ts: CRUD for control limits
 * - qc-lot-changeover.ts: Lot changeover protocol
 */

// QC Materials
export {
    createQCMaterial,
    updateQCMaterial,
    deleteQCMaterial,
    getQCMaterials,
    type GetQCMaterialsParams,
    type GetQCMaterialsResult,
} from './qc-materials'

// QC Definitions
export {
    createQCDefinition,
    updateQCDefinition,
    getQCDefinitions,
} from './qc-definitions'

// Lot Changeover
export {
    getLotChangeoverData,
    completeLotChangeover,
} from './qc-lot-changeover'
