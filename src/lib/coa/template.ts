/**
 * CoA HTML Template Renderer
 *
 * Re-export from modular template directory for backward compatibility.
 * The template has been split into focused modules under ./template/
 *
 * @see ./template/index.ts - Main orchestrator
 * @see ./template/styles.ts - CSS stylesheet
 * @see ./template/header.ts - Header section
 * @see ./template/patient-info.ts - Patient info section
 * @see ./template/results-table.ts - Results table
 * @see ./template/signatures.ts - Signatures section (performer + approver)
 * @see ./template/footer.ts - Footer section
 * @see ./template/metadata.ts - Hidden metadata
 */

export {
    renderCoATemplate,
    generateCoAHtml,
    getStylesheet,
    renderWatermark,
    renderHeader,
    renderPatientInfo,
    renderResultsTable,
    renderSignatures,
    renderAbsoluteFooter,
    renderMetadata,
} from './template/index'
