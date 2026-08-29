import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resolveClientIdentityClient,
  resolveOrCreateClientClient,
} from '@/lib/api-client'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

describe('client resolver v2 API boundaries', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers additive resolver actions through a server-only module', () => {
    const actionTypes = read('src/lib/client-actions/types.ts')
    const route = read('src/app/api/client-actions/route.ts')
    const serverModule = read('src/lib/client-resolution/server.ts')

    expect(actionTypes).toContain("| 'resolveClientIdentityV2'")
    expect(actionTypes).toContain("| 'resolveOrCreateClientV2'")
    expect(route).toMatch(
      /import\s*\{[^}]*resolveClientIdentityV2[^}]*resolveOrCreateClientV2[^}]*\}\s*from '@\/lib\/client-resolution\/server'/,
    )
    expect(serverModule).toContain("import 'server-only'")
    expect(serverModule).toContain(".rpc('resolve_client_identity_v2'")
    expect(serverModule).toContain(".rpc('resolve_or_create_client_v2'")
  })

  it('does not keep a successful direct legacy client upsert caller', () => {
    const clientsAction = read('src/app/actions/clients.ts')
    const shadowHandler = read(
      'src/app/api/client-actions/client-resolution-shadow-handlers.ts',
    )

    expect(clientsAction).not.toContain(".upsert(")
    expect(clientsAction).not.toContain("onConflict: 'name,date_of_birth'")
    expect(clientsAction).toContain('resolveOrCreateClientV2')
    expect(shadowHandler).not.toContain("import { upsertClient }")
    expect(shadowHandler).toContain('resolveOrCreateClientV2')
  })

  it('sends a typed resolver request through src/lib/api-client.ts', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            outcome: 'matched',
            reasonCode: 'trusted_identity_match',
            clientId: '11111111-1111-4111-8111-111111111111',
            created: false,
          },
        }),
        { status: 200 },
      ),
    )

    await resolveClientIdentityClient({
      governmentIdentityType: 'cccd',
      governmentIdentityValue: '086094006827',
      name: 'Nguyễn Văn A',
      dateOfBirth: '1994-09-21',
      phone: '0901234567',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/client-actions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'resolveClientIdentityV2',
          payload: {
            governmentIdentityType: 'cccd',
            governmentIdentityValue: '086094006827',
            name: 'Nguyễn Văn A',
            dateOfBirth: '1994-09-21',
            phone: '0901234567',
          },
        }),
      }),
    )
  })

  it('keeps resolve-and-create behind an unused additive adapter', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            outcome: 'matched',
            reasonCode: 'client_created',
            clientId: '22222222-2222-4222-8222-222222222222',
            created: true,
          },
        }),
        { status: 200 },
      ),
    )

    await resolveOrCreateClientClient({
      governmentIdentityType: null,
      governmentIdentityValue: null,
      name: 'Trần Văn B',
      dateOfBirth: '1980-01-02',
      gender: 'Nữ',
      phone: '0907654321',
    })

    const unexpectedCallers = listSourceFiles(
      join(process.cwd(), 'src'),
    ).filter((path) => {
      if (path.endsWith('src/lib/api-client.ts')) return false
      const source = readFileSync(path, 'utf8')
      return (
        source.includes('resolveClientIdentityClient(') ||
        source.includes('resolveOrCreateClientClient(')
      )
    })

    expect(unexpectedCallers).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/client-actions',
      expect.objectContaining({
        body: expect.stringContaining('"action":"resolveOrCreateClientV2"'),
      }),
    )
  })
})
