/**
 * Prepares stored CoA HTML for printing on pre-printed letterhead.
 *
 * Electronic signatures and the manager stamp are removed while the
 * surrounding signature fields remain available for signing by hand.
 */

const BODY_ONLY_PRINT_STYLES = `
    .header { visibility: hidden !important; border-color: transparent !important; }
    .absolute-footer { display: none !important; }
    .watermark { display: none !important; }
    .content { padding-bottom: 32px !important; }
`

const ELECTRONIC_APPROVAL_SELECTOR = [
    '.signature-image',
    '.manager-stamp-image',
    '[data-coa-stamp="manager"]',
].join(', ')

export function prepareCoABodyOnlyPrintHtml(sourceHtml: string): string {
    const document = new DOMParser().parseFromString(sourceHtml, 'text/html')

    document.querySelectorAll(ELECTRONIC_APPROVAL_SELECTOR).forEach((element) => {
        element.remove()
    })

    const printStyles = document.createElement('style')
    printStyles.dataset.coaPrintMode = 'body-only-manual-sign'
    printStyles.textContent = BODY_ONLY_PRINT_STYLES
    document.head.append(printStyles)

    return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`
}
