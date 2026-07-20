import { describe, expect, it } from 'vitest'

import { getStylesheet } from '../styles'

describe('getStylesheet', () => {
    it('keeps reference-range lines readable inside fixed table columns', () => {
        const stylesheet = getStylesheet()

        expect(stylesheet).toMatch(/\.res-table\s*\{[^}]*table-layout:\s*fixed;/)
        expect(stylesheet).toMatch(/\.res-range\s*\{[^}]*font-size:\s*12px;/)
        expect(stylesheet).toMatch(/\.res-range\s*\{[^}]*overflow-wrap:\s*anywhere;/)
        expect(stylesheet).toMatch(/\.res-range-line\s*\{[^}]*display:\s*block;/)
        expect(stylesheet).toMatch(
            /\.res-range-measurement\s*\{[^}]*white-space:\s*nowrap;/,
        )
        expect(stylesheet).toMatch(
            /\.res-name,\s*\.res-unit,\s*\.res-method\s*\{[^}]*overflow-wrap:\s*anywhere;/,
        )
    })
})
