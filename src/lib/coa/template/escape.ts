/**
 * HTML escaping helpers for CoA template rendering.
 *
 * Use this for both text node content and attribute values. Query parameters
 * must still be URI-encoded before interpolation.
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
