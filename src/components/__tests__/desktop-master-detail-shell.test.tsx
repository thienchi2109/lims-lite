import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DesktopMasterDetailShell } from '../desktop-master-detail-shell'

describe('DesktopMasterDetailShell', () => {
    it('renders a shared 65/35 workspace with dedicated grid and inspector wrappers', () => {
        render(
            <DesktopMasterDetailShell
                workspaceTestId="workspace"
                gridColumnTestId="grid-column"
                inspectorColumnTestId="inspector-column"
                inspectorId="detail-region"
                gridColumnClassName="gap-3"
                inspectorClassName="border-t pt-2"
                left={<div data-testid="left-slot">left</div>}
                right={<div data-testid="right-slot">right</div>}
            />,
        )

        const workspace = screen.getByTestId('workspace')
        const gridColumn = screen.getByTestId('grid-column')
        const inspectorColumn = screen.getByTestId('inspector-column')

        expect(workspace.className).toContain('lg:grid-cols-[minmax(0,1.86fr)_minmax(22rem,1fr)]')
        expect(gridColumn.className).toContain('flex')
        expect(gridColumn.className).toContain('gap-3')
        expect(inspectorColumn.getAttribute('id')).toBe('detail-region')
        expect(inspectorColumn.className).toContain('min-h-0')
        expect(inspectorColumn.className).toContain('border-t')
        expect(screen.getByTestId('left-slot').textContent).toBe('left')
        expect(screen.getByTestId('right-slot').textContent).toBe('right')
    })
})
