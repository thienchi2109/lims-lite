import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCccdSerialController } from './use-cccd-serial-controller'

type MockReaderResult = { value?: Uint8Array; done: boolean }

function createMockSerialPort(chunks: Uint8Array[] = []) {
    let index = 0
    let pendingResolve: ((result: MockReaderResult) => void) | null = null

    const reader = {
        read: vi.fn(async () => {
            if (index < chunks.length) {
                return { value: chunks[index++], done: false }
            }

            return new Promise<MockReaderResult>((resolve) => {
                pendingResolve = resolve
            })
        }),
        cancel: vi.fn(async () => {
            pendingResolve?.({ done: true })
            pendingResolve = null
        }),
        releaseLock: vi.fn(),
    }

    const port = {
        readable: {
            getReader: vi.fn(() => reader),
        },
        open: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
    }

    return { port, reader }
}

function setNavigatorSerial(serial: unknown) {
    Object.defineProperty(window.navigator, 'serial', {
        configurable: true,
        value: serial,
    })
}

describe('useCccdSerialController', () => {
    afterEach(() => {
        vi.clearAllMocks()
        setNavigatorSerial(undefined)
    })

    it('auto-resumes a previously granted port when the dialog becomes active', async () => {
        const onPayload = vi.fn()
        const payload =
            '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|Vĩnh Long|10052021\n'
        const { port } = createMockSerialPort([new TextEncoder().encode(payload)])
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([port]),
            requestPort: vi.fn(),
        }

        setNavigatorSerial(serialApi)

        const { result } = renderHook(
            ({ active }) =>
                useCccdSerialController({
                    active,
                    onPayload,
                }),
            {
                initialProps: { active: true },
            },
        )

        await waitFor(() => {
            expect(serialApi.getPorts).toHaveBeenCalledTimes(1)
            expect(port.open).toHaveBeenCalledTimes(1)
        })

        await waitFor(() => {
            expect(result.current.state).toBe('connected')
            expect(onPayload).toHaveBeenCalledWith(
                '086094006827|331757192|Nguyễn Thiện Chí|21091994|Nam|Vĩnh Long|10052021',
            )
        })
    })

    it('requests a port explicitly when no granted device is available', async () => {
        const onPayload = vi.fn()
        const { port } = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([]),
            requestPort: vi.fn().mockResolvedValue(port),
        }

        setNavigatorSerial(serialApi)

        const { result } = renderHook(() =>
            useCccdSerialController({
                active: true,
                onPayload,
            }),
        )

        await waitFor(() => {
            expect(result.current.state).toBe('permission_required')
        })

        await act(async () => {
            await result.current.connect()
        })

        await waitFor(() => {
            expect(serialApi.requestPort).toHaveBeenCalledTimes(1)
            expect(port.open).toHaveBeenCalledTimes(1)
            expect(result.current.state).toBe('connected')
        })
    })

    it('disconnects on dialog close and auto-resumes on reopen without requesting permission again', async () => {
        const { port, reader } = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([port]),
            requestPort: vi.fn(),
        }

        setNavigatorSerial(serialApi)

        const { result, rerender } = renderHook(
            ({ active }) =>
                useCccdSerialController({
                    active,
                    onPayload: vi.fn(),
                }),
            {
                initialProps: { active: true },
            },
        )

        await waitFor(() => {
            expect(result.current.state).toBe('connected')
        })

        await act(async () => {
            rerender({ active: false })
        })

        await waitFor(() => {
            expect(reader.cancel).toHaveBeenCalledTimes(1)
            expect(port.close).toHaveBeenCalledTimes(1)
            expect(result.current.state).toBe('permission_required')
        })

        await act(async () => {
            rerender({ active: true })
        })

        await waitFor(() => {
            expect(serialApi.getPorts).toHaveBeenCalledTimes(2)
            expect(port.open).toHaveBeenCalledTimes(2)
            expect(serialApi.requestPort).not.toHaveBeenCalled()
            expect(result.current.state).toBe('connected')
        })
    })
})
