import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApprovalLayoutSwitcher } from '../approval-layout-switcher'

let matchMediaMatches = false

function DesktopProbe() {
    return <div data-testid="desktop-probe">desktop</div>
}

function MobileProbe() {
    return <div data-testid="mobile-probe">mobile</div>
}

function createOwnerProbe(testId: string, onMount: () => void) {
    return function OwnerProbe() {
        useEffect(() => {
            onMount()
        }, [])

        return <div data-testid={testId}>{testId}</div>
    }
}

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

function installMatchMedia() {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
            matches: matchMediaMatches,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    )
}

describe('ApprovalLayoutSwitcher', () => {
    it('mounts only the desktop layout at desktop breakpoint', () => {
        matchMediaMatches = true
        installMatchMedia()

        render(
            <ApprovalLayoutSwitcher
                desktop={<DesktopProbe />}
                mobile={<MobileProbe />}
            />,
        )

        expect(screen.getByTestId('desktop-probe')).toBeDefined()
        expect(screen.queryByTestId('mobile-probe')).toBeNull()
    })

    it('mounts only the mobile layout below the desktop breakpoint', () => {
        matchMediaMatches = false
        installMatchMedia()

        render(
            <ApprovalLayoutSwitcher
                desktop={<DesktopProbe />}
                mobile={<MobileProbe />}
            />,
        )

        expect(screen.getByTestId('mobile-probe')).toBeDefined()
        expect(screen.queryByTestId('desktop-probe')).toBeNull()
    })

    it('renders the inert initial fallback during server render instead of a blank shell', () => {
        const markup = renderToStaticMarkup(
            <ApprovalLayoutSwitcher
                desktop={<DesktopProbe />}
                mobile={<MobileProbe />}
                initial={<div data-testid="initial-probe">initial</div>}
            />,
        )

        expect(markup).toContain('initial-probe')
        expect(markup).not.toContain('mobile-probe')
    })

    it('does not mount the desktop owner on mobile before switching to the active layout', () => {
        matchMediaMatches = false
        installMatchMedia()
        const desktopMountSpy = vi.fn()
        const mobileMountSpy = vi.fn()
        const DesktopOwnerProbe = createOwnerProbe('desktop-owner-probe', desktopMountSpy)
        const MobileOwnerProbe = createOwnerProbe('mobile-owner-probe', mobileMountSpy)

        render(
            <ApprovalLayoutSwitcher
                desktop={<DesktopOwnerProbe />}
                mobile={<MobileOwnerProbe />}
                initial={<div data-testid="initial-probe">initial</div>}
            />,
        )

        expect(screen.getByTestId('mobile-owner-probe')).toBeDefined()
        expect(screen.queryByTestId('desktop-owner-probe')).toBeNull()
        expect(desktopMountSpy).not.toHaveBeenCalled()
        expect(mobileMountSpy).toHaveBeenCalledTimes(1)
    })
})
