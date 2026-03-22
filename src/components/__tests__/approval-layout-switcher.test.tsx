import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/hooks/use-media-query', () => ({
    useMediaQuery: vi.fn(),
}))

import { useMediaQuery } from '@/hooks/use-media-query'
import { ApprovalLayoutSwitcher } from '../approval-layout-switcher'

const mockUseMediaQuery = vi.mocked(useMediaQuery)

function DesktopProbe() {
    return <div data-testid="desktop-probe">desktop</div>
}

function MobileProbe() {
    return <div data-testid="mobile-probe">mobile</div>
}

afterEach(() => {
    vi.clearAllMocks()
})

describe('ApprovalLayoutSwitcher', () => {
    it('mounts only the desktop layout at desktop breakpoint', () => {
        mockUseMediaQuery.mockReturnValue(true)

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
        mockUseMediaQuery.mockReturnValue(false)

        render(
            <ApprovalLayoutSwitcher
                desktop={<DesktopProbe />}
                mobile={<MobileProbe />}
            />,
        )

        expect(screen.getByTestId('mobile-probe')).toBeDefined()
        expect(screen.queryByTestId('desktop-probe')).toBeNull()
    })

    it('renders the desktop fallback during server render instead of a blank shell', () => {
        mockUseMediaQuery.mockReturnValue(false)

        const markup = renderToStaticMarkup(
            <ApprovalLayoutSwitcher
                desktop={<DesktopProbe />}
                mobile={<MobileProbe />}
            />,
        )

        expect(markup).toContain('desktop-probe')
        expect(markup).not.toContain('mobile-probe')
    })
})
