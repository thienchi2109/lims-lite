import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Ensures the root route (/) renders the portal page without middleware redirect.
 * If this test fails, the portal page is being redirected away from.
 */
describe('Portal root route configuration', () => {
    const rootDir = join(__dirname, '..', '..')

    it('should NOT redirect root route in middleware', () => {
        const middleware = readFileSync(join(rootDir, 'src/middleware.ts'), 'utf-8')
        expect(middleware).not.toMatch(/isRootRoute[\s\S]*?redirect/)
    })

    it('should have a portal page at src/app/page.tsx', () => {
        const page = readFileSync(join(rootDir, 'src/app/page.tsx'), 'utf-8')
        expect(page).toContain('CDC LIMS')
        expect(page).toContain('CVMEMS')
    })

    it('should have noindex metadata on portal page', () => {
        const page = readFileSync(join(rootDir, 'src/app/page.tsx'), 'utf-8')
        expect(page).toMatch(/robots.*index:\s*false/)
    })
})
