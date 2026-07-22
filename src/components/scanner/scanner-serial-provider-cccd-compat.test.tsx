import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCccdSerialController } from '@/hooks/use-cccd-serial-controller'

import { ScannerSerialProvider } from './scanner-serial-provider'
import { createMockSerialPort, setNavigatorSerial } from './scanner-serial-test-helpers'

function LegacyCccdProbe({
    active,
    onPayload,
}: {
    active: boolean
    onPayload: (payload: string) => void
}) {
    const controller = useCccdSerialController({ active, onPayload })
    return <span data-testid="legacy-state">{controller.state}</span>
}

describe('ScannerSerialProvider CCCD compatibility', () => {
    afterEach(() => {
        vi.clearAllMocks()
        setNavigatorSerial(undefined)
    })

    it('delivers CCCD payloads through the provider without opening a second reader', async () => {
        const rawPayload =
            '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|Vĩnh Long|10052021'
        const onPayload = vi.fn()
        const mockPort = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([mockPort.port]),
            requestPort: vi.fn(),
        }
        setNavigatorSerial(serialApi)

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <LegacyCccdProbe active onPayload={onPayload} />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('legacy-state').textContent).toBe('connected')
        })

        await act(async () => {
            mockPort.pushChunk(new TextEncoder().encode(`${rawPayload}\r\n`))
        })

        await waitFor(() => {
            expect(onPayload).toHaveBeenCalledWith(rawPayload)
        })
        expect(serialApi.getPorts).toHaveBeenCalledTimes(1)
        expect(mockPort.port.open).toHaveBeenCalledTimes(1)
        expect(mockPort.port.readable.getReader).toHaveBeenCalledTimes(1)
        expect(serialApi.requestPort).not.toHaveBeenCalled()
    })
})
