/**
 * Ensures operators and future consumers receive the security and connection
 * instructions required by the private PDF gateway contract.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { repositoryRoot } from './helpers/compose-config'

const documentPaths = {
  consumer: 'docs/security/pdf-gateway-consumer-guide.md',
  operations: 'docs/security/pdf-gateway-operations-runbook.md',
  threatModel: 'docs/security/pdf-gateway-threat-model.md',
}

function readRequiredDocument(relativePath: string) {
  const absolutePath = resolve(repositoryRoot, relativePath)
  expect(existsSync(absolutePath), `${relativePath} must exist`).toBe(true)
  return readFileSync(absolutePath, 'utf8')
}

describe('PDF gateway security documentation', () => {
  test('documents the complete gateway threat model', () => {
    const content = readRequiredDocument(documentPaths.threatModel)

    expect(content).toMatch(/Mô hình đe dọa/i)
    expect(content).toMatch(/SSRF/)
    expect(content).toMatch(/cạn kiệt tài nguyên/i)
    expect(content).toMatch(/HTML độc hại/i)
    expect(content).toMatch(/rò rỉ thông tin xác thực/i)
    expect(content).toMatch(/di chuyển ngang/i)
    expect(content).toMatch(/logo|QR/i)
    expect(content).toMatch(/không.*nội dung|không.*tệp/i)
  })

  test('provides a Vietnamese deployment and rollback runbook', () => {
    const content = readRequiredDocument(documentPaths.operations)

    expect(content).toMatch(/Hướng dẫn vận hành/i)
    expect(content).toContain('/root/lims-lite')
    expect(content).toContain('/opt/lims-lite')
    expect(content).toContain('ssh -o BatchMode=yes')
    expect(content).toContain('openssl rand')
    expect(content).toContain('sha256sum')
    expect(content).toContain('chmod 600')
    expect(content).toContain('docker compose config')
    expect(content).toContain('docker inspect')
    expect(content).toContain('docker logs')
    expect(content).toContain(
      'docker exec -i lims-app node --input-type=module -'
    )
    expect(content).toMatch(/Hoàn tác|Rollback/i)
    expect(content).toMatch(/không.*database|không.*cơ sở dữ liệu/i)
  })

  test('gives future applications a safe connection contract linked to Issue #84', () => {
    const content = readRequiredDocument(documentPaths.consumer)

    expect(content).toMatch(/Hướng dẫn tích hợp/i)
    expect(content).toContain('Issue #84')
    expect(content).toMatch(/chưa.*Tailscale|không.*Tailscale/i)
    expect(content).toContain('/v1/convert/html')
    expect(content).toContain('Authorization: Bearer')
    expect(content).toContain('index.html')
    expect(content).toContain('emulatedMediaType')
    expect(content).toContain('failOnResourceHttpStatusCodes')
    expect(content).toContain('curl')
    expect(content).toContain('--config -')
    expect(content).not.toMatch(
      /--header\s+["']Authorization: Bearer \$\(cat/
    )
    expect(content).toContain('FormData')
    expect(content).toContain('x-request-id')
    expect(content).toMatch(/401/)
    expect(content).toMatch(/413/)
    expect(content).toMatch(/429/)
    expect(content).toMatch(/502/)
    expect(content).toMatch(/504/)
    expect(content).toMatch(/xoay vòng|rotation/i)
    expect(content).toMatch(/không.*commit|không.*Git/i)
    expect(content).toMatch(/không.*gotenberg:3000/i)
  })
})
