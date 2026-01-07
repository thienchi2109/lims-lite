import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * This test ensures cookie name consistency across all Supabase client files.
 *
 * WHY THIS MATTERS:
 * Supabase SSR defaults to deriving cookie names from the URL hostname,
 * causing mismatches between environments (localhost vs Docker vs production).
 * All clients MUST use the same explicit cookie name.
 *
 * If this test fails, authentication will break in some environments.
 */
describe('Supabase cookie configuration', () => {
    const rootDir = join(__dirname, '..', '..')
    const constantsFile = join(rootDir, 'src/lib/supabase/constants.ts')

    const clientFiles = [
        'src/lib/supabase/client.ts',
        'src/lib/supabase/server.ts',
        'src/middleware.ts',
    ]

    it('should have SUPABASE_COOKIE_NAME exported from constants.ts', () => {
        const content = readFileSync(constantsFile, 'utf-8')
        expect(content).toMatch(/export const SUPABASE_COOKIE_NAME\s*=\s*['"]sb-lims-auth-token['"]/)
    })

    it('should import SUPABASE_COOKIE_NAME in all client files', () => {
        for (const file of clientFiles) {
            const filePath = join(rootDir, file)
            const content = readFileSync(filePath, 'utf-8')

            expect(content).toContain("import { SUPABASE_COOKIE_NAME } from '@/lib/supabase/constants'")
        }
    })

    it('should use SUPABASE_COOKIE_NAME in cookieOptions', () => {
        for (const file of clientFiles) {
            const filePath = join(rootDir, file)
            const content = readFileSync(filePath, 'utf-8')

            // Verify the cookie name is used in cookieOptions
            expect(content).toMatch(/cookieOptions:\s*\{[\s\S]*?name:\s*SUPABASE_COOKIE_NAME/)
        }
    })

    it('should NOT have local COOKIE_NAME constants (use centralized constant)', () => {
        for (const file of clientFiles) {
            const filePath = join(rootDir, file)
            const content = readFileSync(filePath, 'utf-8')

            // Ensure no local COOKIE_NAME definition exists
            expect(content).not.toMatch(/const COOKIE_NAME\s*=/)
        }
    })
})
