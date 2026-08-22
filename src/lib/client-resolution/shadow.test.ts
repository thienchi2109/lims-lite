import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}))

import { runClientResolutionShadow } from './shadow'

const SHADOW_INPUT = {
  category: 'manual' as const,
  input: {
    governmentIdentityType: null,
    governmentIdentityValue: null,
    name: 'Nguyen Van A',
    dateOfBirth: '1994-09-21',
    phone: null,
  },
}

describe('client resolution shadow boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLIENT_RESOLUTION_SHADOW_CATEGORIES = 'manual,qr,upsert'
    process.env.CLIENT_RESOLUTION_SHADOW_TIMEOUT_MS = '250'
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: '11111111-1111-4111-8111-111111111111',
        },
      },
      error: null,
    })
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: mocks.getUser,
      },
    })
    mocks.abortSignal.mockResolvedValue({
      data: null,
      error: null,
    })
    mocks.rpc.mockReturnValue({
      abortSignal: mocks.abortSignal,
    })
    mocks.createAdminClient.mockReturnValue({
      rpc: mocks.rpc,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.CLIENT_RESOLUTION_SHADOW_CATEGORIES
    delete process.env.CLIENT_RESOLUTION_SHADOW_TIMEOUT_MS
  })

  it('stays disabled unless a server environment category enables it', async () => {
    process.env.CLIENT_RESOLUTION_SHADOW_CATEGORIES = 'off'

    await runClientResolutionShadow(SHADOW_INPUT)

    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('records an enabled category through the service-role-only RPC', async () => {
    await runClientResolutionShadow(SHADOW_INPUT)

    expect(mocks.rpc).toHaveBeenCalledWith(
      'record_client_resolution_shadow_v1',
      expect.objectContaining({
        p_actor_id: '11111111-1111-4111-8111-111111111111',
        p_caller_category: 'manual',
        p_government_identity_type: null,
        p_government_identity_value: null,
        p_name: 'Nguyen Van A',
        p_date_of_birth: '1994-09-21',
        p_phone: null,
        p_correlation_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    )
    expect(mocks.abortSignal).toHaveBeenCalledWith(
      expect.any(AbortSignal),
    )
  })

  it('does not record categories that are not enabled by the server', async () => {
    process.env.CLIENT_RESOLUTION_SHADOW_CATEGORIES = 'qr'

    await runClientResolutionShadow(SHADOW_INPUT)

    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('fails closed before service-role access when no authenticated actor exists', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    await runClientResolutionShadow(SHADOW_INPUT)

    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('contains RPC failures without exposing request data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.abortSignal.mockResolvedValue({
      data: null,
      error: {
        message: 'database rejected identity 086094006827',
      },
    })

    await expect(
      runClientResolutionShadow(SHADOW_INPUT),
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledWith(
      'Client resolution shadow comparison failed',
      {
        category: 'manual',
        reason: 'rpc_error',
      },
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain('086094006827')
    warn.mockRestore()
  })

  it('aborts within the configured performance budget and returns control', async () => {
    vi.useFakeTimers()
    process.env.CLIENT_RESOLUTION_SHADOW_TIMEOUT_MS = '25'
    mocks.abortSignal.mockImplementation(
      (signal: AbortSignal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            resolve({
              data: null,
              error: { message: 'aborted' },
            })
          })
        }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const shadowPromise = runClientResolutionShadow(SHADOW_INPUT)
    await vi.advanceTimersByTimeAsync(25)
    await expect(shadowPromise).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledWith(
      'Client resolution shadow comparison failed',
      {
        category: 'manual',
        reason: 'timeout',
      },
    )
    warn.mockRestore()
  })
})
