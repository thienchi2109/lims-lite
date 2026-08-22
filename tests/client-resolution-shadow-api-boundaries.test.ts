import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('client resolution shadow API boundaries', () => {
  it('keeps the switch server-only and assigns caller categories in server code', () => {
    const compose = read('docker-compose.yml')
    const envExample = read('.env.example')
    const route = read('src/app/api/client-actions/route.ts')
    const apiClient = read('src/lib/api-client.ts')
    const qrHook = read('src/hooks/use-client-identity-scan.ts')

    expect(compose).toContain('CLIENT_RESOLUTION_SHADOW_CATEGORIES')
    expect(compose).toContain('CLIENT_RESOLUTION_SHADOW_TIMEOUT_MS')
    expect(envExample).toContain('CLIENT_RESOLUTION_SHADOW_CATEGORIES=off')
    expect(envExample).not.toContain(
      'NEXT_PUBLIC_CLIENT_RESOLUTION_SHADOW',
    )
    expect(route).toContain('findClientByIdentityWithShadow')
    expect(route).toContain("category: 'manual'")
    expect(route).toContain("category: 'qr'")
    expect(route).toContain('upsertClientWithShadow')
    expect(apiClient).toContain('findClientByIdentityQrClient')
    expect(qrHook).toContain('findClientByIdentityQrClient')
  })
})
