import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APPROVED_PORTAL_APPS = [
    {
        title: 'CDC LIMS',
        description: 'Hệ thống quản lý thông tin xét nghiệm',
        href: '/login',
        external: false,
    },
    {
        title: 'Quản lý TBYT CDC',
        description: 'Quản lý thiết bị y tế CDC',
        href: 'https://quan-ly-tbyt.pages.dev/',
        external: true,
    },
    {
        title: 'Cổng tra cứu kết quả xét nghiệm',
        description: 'Tra cứu và xác thực phiếu kết quả xét nghiệm',
        href: 'https://cdclims.cloud/coa/access',
        external: true,
    },
] as const

function getPortalAppBlocks(page: string) {
    const appsSource = page.match(/const apps = \[([\s\S]*?)\] as const/)?.[1]

    expect(appsSource).toBeDefined()

    return [...appsSource!.matchAll(/\{\s*title:[\s\S]*?external:\s*(?:true|false),?\s*\}/g)]
        .map((match) => match[0])
}

/**
 * Ensures the root route (/) renders the portal page without middleware redirect.
 * If this test fails, the portal page is being redirected away from.
 */
describe('Portal root route configuration', () => {
    const rootDir = join(__dirname, '..', '..')
    const page = readFileSync(join(rootDir, 'src/app/page.tsx'), 'utf-8')
    const layout = readFileSync(join(rootDir, 'src/app/layout.tsx'), 'utf-8')
    const globalStyles = readFileSync(join(rootDir, 'src/app/globals.css'), 'utf-8')

    it('should NOT redirect root route in middleware', () => {
        const middleware = readFileSync(join(rootDir, 'src/middleware.ts'), 'utf-8')
        expect(middleware).not.toMatch(/isRootRoute[\s\S]*?redirect/)
    })

    it('should expose exactly the three approved portal destinations', () => {
        const appBlocks = getPortalAppBlocks(page)

        expect(appBlocks).toHaveLength(APPROVED_PORTAL_APPS.length)

        APPROVED_PORTAL_APPS.forEach((app, index) => {
            expect(appBlocks[index]).toContain(`title: '${app.title}'`)
            expect(appBlocks[index]).toContain(`description: '${app.description}'`)
            expect(appBlocks[index]).toContain(`href: '${app.href}'`)
            expect(appBlocks[index]).toContain(`external: ${app.external}`)
        })

        expect(page).not.toContain('CVMEMS')
        expect(page).not.toContain('Đào tạo nhân lực y tế')
        expect(page).not.toContain('Cổng dịch vụ công')
    })

    it('should use three desktop columns and one scrollable mobile column', () => {
        expect(page).toContain('min-h-dvh')
        expect(page).toContain('max-w-[1360px]')
        expect(page).toMatch(/className="[^"]*grid[^"]*grid-cols-1[^"]*lg:grid-cols-3[^"]*"/)
        expect(page).not.toContain('sm:grid-cols-2')
        expect(page).not.toContain('md:grid-cols-2')
        expect(page).not.toContain('overflow-hidden')
    })

    it('should keep the phrase "xét nghiệm" together in the third card title', () => {
        const thirdApp = getPortalAppBlocks(page)[2]

        expect(thirdApp).toContain(`keepTitleSuffixTogether: 'xét nghiệm'`)
        expect(page).toMatch(
            /<span className="whitespace-nowrap">\s*\{app\.keepTitleSuffixTogether\}\s*<\/span>/
        )
    })

    it('should inherit the shared Inter font without a page-level font override', () => {
        expect(page).toContain('font-sans')
        expect(page).not.toMatch(/Be_Vietnam_Pro|Be Vietnam Pro/)
        expect(page).not.toContain('next/font/google')
        expect(layout).toMatch(/import\s*\{[^}]*\bInter\b[^}]*\}\s*from\s*["']next\/font\/google["']/)
        expect(layout).toContain('variable: "--font-inter"')
        expect(globalStyles).toContain('--font-sans: var(--font-inter)')
    })

    it('should have noindex metadata on portal page', () => {
        expect(page).toMatch(/robots.*index:\s*false/)
    })
})
