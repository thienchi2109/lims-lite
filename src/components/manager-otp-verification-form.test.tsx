import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({
    replace: vi.fn(),
    refresh: vi.fn(),
}))

const locationAssign = vi.hoisted(() => vi.fn())
const locationReplace = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
    useRouter: () => router,
}))

Object.defineProperty(window, 'location', {
    value: {
        ...window.location,
        assign: locationAssign,
        replace: locationReplace,
    },
    writable: true,
})

import { ManagerOtpVerificationForm } from './manager-otp-verification-form'

function getOtpDigitInputs() {
    return Array.from({ length: 6 }, (_value, index) =>
        screen.getByLabelText(`Số OTP ${index + 1}`) as HTMLInputElement,
    )
}

function enterOtp(code: string) {
    const inputs = getOtpDigitInputs()
    code.split('').forEach((digit, index) => {
        fireEvent.change(inputs[index], { target: { value: digit } })
    })
}

describe('ManagerOtpVerificationForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/api/manager/otp/challenge')) {
                return Response.json({
                    ok: true,
                    challengeId: '33333333-3333-4333-8333-333333333333',
                    maskedEmail: 'ma***@example.com',
                    expiresAt: '2026-06-02T04:05:00.000Z',
                    resendAvailableAt: '2026-06-02T04:01:00.000Z',
                })
            }

            if (url.endsWith('/api/manager/otp/verify')) {
                return Response.json({ ok: true })
            }

            return Response.json({ ok: false, status: 'provider_failed' }, { status: 503 })
        }) as typeof fetch
    })

    it('sends an OTP, shows the masked destination, and verifies a six-digit code', async () => {
        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/Mã OTP đã được gửi đến ma\*\*\*@example\.com\./i)).toBeDefined()
        expect(screen.getByText(/ma\*\*\*@example\.com/)).toBeDefined()

        expect(getOtpDigitInputs()).toHaveLength(6)
        enterOtp('123456')
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/manager/otp/verify', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    challengeId: '33333333-3333-4333-8333-333333333333',
                    code: '123456',
                }),
            }))
        })
        expect(locationReplace).toHaveBeenCalledWith('/manager')
        expect(locationAssign).not.toHaveBeenCalled()
        expect(router.replace).not.toHaveBeenCalled()
        expect(router.refresh).not.toHaveBeenCalled()
    })

    it('redirects to the analyst workspace after analyst HIV OTP verification', async () => {
        render(
            <ManagerOtpVerificationForm
                initialMaskedEmail="an***@example.com"
                successRedirectPath="/analyst"
            />,
        )

        expect(await screen.findByText(/Mã OTP đã được gửi đến ma\*\*\*@example\.com\./i)).toBeDefined()
        enterOtp('123456')
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

        await waitFor(() => {
            expect(locationReplace).toHaveBeenCalledWith('/analyst')
        })
    })

    it('shows Vietnamese provider-failure guidance without exposing a full email address', async () => {
        global.fetch = vi.fn(async () => Response.json(
            { ok: false, status: 'provider_failed', maskedEmail: 'ma***@example.com' },
            { status: 503 },
        )) as typeof fetch

        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/không thể gửi mã OTP/i)).toBeDefined()
        expect(screen.getAllByText(/liên hệ quản trị viên/i).length).toBeGreaterThan(0)
        expect(screen.queryByText(/mã OTP đã được gửi đến/i)).toBeNull()
        expect(screen.queryByText('manager@example.com')).toBeNull()
    })

    it('lets the manager retry when the initial OTP challenge request fails', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(Response.json(
                { ok: false, status: 'provider_failed', maskedEmail: 'ma***@example.com' },
                { status: 503 },
            ))
            .mockResolvedValueOnce(Response.json({
                ok: true,
                challengeId: '33333333-3333-4333-8333-333333333333',
                maskedEmail: 'ma***@example.com',
                expiresAt: '2026-06-02T04:05:00.000Z',
                resendAvailableAt: '2026-06-02T04:01:00.000Z',
            }))
        global.fetch = fetchMock as unknown as typeof fetch

        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/không thể gửi mã OTP/i)).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Thử gửi lại' }))

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2)
        })
        await waitFor(() => {
            expect(screen.getAllByText(/mã OTP đã được gửi/i).length).toBeGreaterThan(0)
        })
    })

    it('does not start a retry while the initial challenge request is pending', async () => {
        const fetchMock = vi.fn(async () => new Promise<Response>(() => undefined))
        global.fetch = fetchMock as unknown as typeof fetch

        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        fireEvent.click(screen.getByRole('button', { name: 'Thử gửi lại' }))

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1)
        })
    })

    it('lets the manager retry after StrictMode replays the initial challenge effect', async () => {
        const fetchMock = vi
            .fn()
            .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
            .mockResolvedValueOnce(Response.json({
                ok: false,
                status: 'cooldown',
                challengeId: '33333333-3333-4333-8333-333333333333',
                maskedEmail: 'ma***@example.com',
                expiresAt: '2026-06-02T04:05:00.000Z',
                resendAvailableAt: '2026-06-02T04:01:00.000Z',
            }, { status: 429 }))
            .mockResolvedValueOnce(Response.json({ ok: true }))
        global.fetch = fetchMock as unknown as typeof fetch

        render(
            <StrictMode>
                <ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />
            </StrictMode>,
        )

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1)
        })
        await waitFor(() => {
            expect((screen.getByRole('button', { name: 'Thử gửi lại' }) as HTMLButtonElement).disabled).toBe(false)
        })
        fireEvent.click(screen.getByRole('button', { name: 'Thử gửi lại' }))

        expect(await screen.findByText(/chưa thể gửi lại mã/i)).toBeDefined()
        enterOtp('123456')
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/manager/otp/verify', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    challengeId: '33333333-3333-4333-8333-333333333333',
                    code: '123456',
                }),
            }))
        })
    })

    it('lets the manager verify when the initial challenge request succeeds', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(Response.json({
                ok: true,
                challengeId: '33333333-3333-4333-8333-333333333333',
                maskedEmail: 'ma***@example.com',
                expiresAt: '2026-06-02T04:05:00.000Z',
                resendAvailableAt: '2026-06-02T04:01:00.000Z',
            }))
            .mockResolvedValueOnce(Response.json({ ok: true }))
        global.fetch = fetchMock as unknown as typeof fetch

        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/Mã OTP đã được gửi đến ma\*\*\*@example\.com\./i)).toBeDefined()
        enterOtp('123456')
        await waitFor(() => {
            expect((screen.getByRole('button', { name: 'Xác nhận' }) as HTMLButtonElement).disabled).toBe(false)
        })
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2)
        })
    })

    it('preserves the active challenge returned by a cooldown response after reload', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(Response.json({
                ok: false,
                status: 'cooldown',
                challengeId: '44444444-4444-4444-8444-444444444444',
                maskedEmail: 'ma***@example.com',
                expiresAt: '2026-06-02T04:05:00.000Z',
                resendAvailableAt: '2026-06-02T04:01:00.000Z',
            }, { status: 429 }))
            .mockResolvedValueOnce(Response.json({ ok: true }))
        global.fetch = fetchMock as unknown as typeof fetch

        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/chưa thể gửi lại mã/i)).toBeDefined()
        enterOtp('123456')
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/manager/otp/verify', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    challengeId: '44444444-4444-4444-8444-444444444444',
                    code: '123456',
                }),
            }))
        })
    })

    it('pastes a six-digit OTP across the separated digit boxes', async () => {
        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/Mã OTP đã được gửi đến ma\*\*\*@example\.com\./i)).toBeDefined()
        fireEvent.paste(screen.getByLabelText('Số OTP 1'), {
            clipboardData: { getData: () => '123456' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/manager/otp/verify', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    challengeId: '33333333-3333-4333-8333-333333333333',
                    code: '123456',
                }),
            }))
        })
    })

    it('moves back when pressing Backspace in an empty OTP digit box', async () => {
        render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        expect(await screen.findByText(/Mã OTP đã được gửi đến ma\*\*\*@example\.com\./i)).toBeDefined()
        enterOtp('12')
        const inputs = getOtpDigitInputs()

        fireEvent.keyDown(inputs[2], { key: 'Backspace' })

        expect(document.activeElement).toBe(inputs[1])
        expect(inputs[1].value).toBe('')
    })

    it('aborts the initial challenge request when the verification surface unmounts', async () => {
        let requestSignal: AbortSignal | undefined
        global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            requestSignal = init?.signal ?? undefined
            return new Promise<Response>(() => undefined)
        }) as typeof fetch

        const { unmount } = render(<ManagerOtpVerificationForm initialMaskedEmail="ma***@example.com" />)

        await waitFor(() => {
            expect(requestSignal).toBeDefined()
        })
        expect(requestSignal?.aborted).toBe(false)

        unmount()

        expect(requestSignal?.aborted).toBe(true)
    })
})
