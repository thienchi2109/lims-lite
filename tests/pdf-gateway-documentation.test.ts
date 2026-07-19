/**
 * Ensures operators and future consumers receive the security and connection
 * instructions required by the private PDF gateway contract.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { repositoryRoot } from './helpers/compose-config'

const documentPaths = {
  appImage: 'Dockerfile',
  consumer: 'docs/security/pdf-gateway-consumer-guide.md',
  gatewayImage: 'ops/pdf-gateway/Dockerfile',
  operations: 'docs/security/pdf-gateway-operations-runbook.md',
  threatModel: 'docs/security/pdf-gateway-threat-model.md',
}

function readRequiredDocument(relativePath: string) {
  const absolutePath = resolve(repositoryRoot, relativePath)
  expect(existsSync(absolutePath), `${relativePath} must exist`).toBe(true)
  return readFileSync(absolutePath, 'utf8')
}

function extractRuntimeGroupId(
  relativePath: string,
  groupName: string,
  userName: string,
  runtimeUserStyle: 'named' | 'numeric'
) {
  const content = readRequiredDocument(relativePath)
  const groupMatch = content.match(
    new RegExp(`addgroup\\s+--system\\s+--gid\\s+(\\d+)\\s+${groupName}`)
  )
  const userMatch = content.match(
    new RegExp(
      `adduser\\s+--system\\s+--uid\\s+(\\d+)\\s+--ingroup\\s+${groupName}\\s+${userName}`
    )
  )
  const runtimeUser = [...content.matchAll(/^USER\s+(.+)$/gm)].at(-1)?.[1]

  expect(
    groupMatch,
    `${relativePath} must define the ${groupName} GID`
  ).not.toBeNull()
  expect(
    userMatch,
    `${relativePath} must assign ${userName} to ${groupName}`
  ).not.toBeNull()

  const groupId = groupMatch?.[1] ?? ''
  const userId = userMatch?.[1] ?? ''
  const expectedRuntimeUser =
    runtimeUserStyle === 'named' ? userName : `${userId}:${groupId}`

  expect(runtimeUser).toBe(expectedRuntimeUser)
  return groupId
}

function extractSecretPermissionCommands(content: string, secretPath: string) {
  return content
    .replace(/\\\r?\n\s*/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.includes(secretPath) && /\b(?:chown|chmod|install)\b/.test(line)
    )
}

function extractContainerVerificationCommands(
  content: string,
  containerName: string
) {
  const match = content.match(
    new RegExp(
      `sudo -n docker exec ${containerName} sh -eu -c '\\n([\\s\\S]*?)\\n'`
    )
  )

  expect(
    match,
    `runbook must verify secrets inside ${containerName}`
  ).not.toBeNull()

  return (match?.[1] ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
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
    expect(content).toContain('chmod 640')
    expect(content).toContain('docker compose config')
    expect(content).toContain('docker inspect')
    expect(content).toContain('docker logs')
    expect(content).toContain(
      'docker exec -i lims-app node --input-type=module -'
    )
    expect(content).toMatch(/Hoàn tác|Rollback/i)
    expect(content).toMatch(/không.*database|không.*cơ sở dữ liệu/i)
  })

  test('documents least-privilege secret permissions readable by non-root containers', () => {
    const content = readRequiredDocument(documentPaths.operations)
    const appGroupId = extractRuntimeGroupId(
      documentPaths.appImage,
      'nodejs',
      'nextjs',
      'named'
    )
    const gatewayGroupId = extractRuntimeGroupId(
      documentPaths.gatewayImage,
      'pdfgateway',
      'pdfgateway',
      'numeric'
    )
    const appTokenPath =
      '/opt/lims-lite-secrets/pdf-gateway-lims-token'
    const gatewayPolicyPath =
      '/opt/lims-lite-secrets/pdf-gateway-client-policy.json'

    expect(content).toMatch(/file-backed.*giữ nguyên.*quyền/i)
    expect(content).toContain(`LIMS app chạy GID \`${appGroupId}\``)
    expect(content).toContain(`PDF gateway chạy GID \`${gatewayGroupId}\``)
    expect(extractSecretPermissionCommands(content, appTokenPath)).toEqual([
      `sudo -n chown root:${appGroupId} ${appTokenPath}`,
      `sudo -n chmod 640 ${appTokenPath}`,
    ])
    expect(extractSecretPermissionCommands(content, gatewayPolicyPath)).toEqual([
      `sudo -n chown root:${gatewayGroupId} ${gatewayPolicyPath}`,
      `sudo -n chmod 640 ${gatewayPolicyPath}`,
    ])
    expect(extractContainerVerificationCommands(content, 'lims-app')).toEqual([
      'id',
      'stat -c "%n %u:%g %a" /run/secrets/pdf_gateway_lims_token',
      'test -r /run/secrets/pdf_gateway_lims_token',
      `test "$(stat -c "%u:%g:%a" /run/secrets/pdf_gateway_lims_token)" = "0:${appGroupId}:640"`,
      'test ! -e /run/secrets/pdf_gateway_client_policy',
    ])
    expect(
      extractContainerVerificationCommands(content, 'lims-pdf-gateway')
    ).toEqual([
      'id',
      'stat -c "%n %u:%g %a" /run/secrets/pdf_gateway_client_policy',
      'test -r /run/secrets/pdf_gateway_client_policy',
      `test "$(stat -c "%u:%g:%a" /run/secrets/pdf_gateway_client_policy)" = "0:${gatewayGroupId}:640"`,
      'test ! -e /run/secrets/pdf_gateway_lims_token',
    ])
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
