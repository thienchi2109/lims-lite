/**
 * Validates private network segmentation, secret wiring, and runtime hardening
 * for the LIMS PDF gateway path.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  loadComposeConfig,
  loadExampleEnvironment,
  repositoryRoot,
} from './helpers/compose-config'

const composeConfig = loadComposeConfig()
const appService = composeConfig.services.app
const gatewayService = composeConfig.services['pdf-gateway']
const gotenbergService = composeConfig.services.gotenberg

function servicesOnNetwork(networkName: string) {
  return Object.entries(composeConfig.services)
    .filter(([, service]) =>
      Object.hasOwn((service as { networks?: object }).networks ?? {}, networkName)
    )
    .map(([serviceName]) => serviceName)
    .sort()
}

describe('PDF service network isolation', () => {
  test('segments the LIMS client path from the raw Gotenberg upstream', () => {
    expect(servicesOnNetwork('pdf-client')).toEqual(['app', 'pdf-gateway'])
    expect(servicesOnNetwork('pdf-upstream')).toEqual([
      'gotenberg',
      'pdf-gateway',
    ])
    expect(appService.networks).toEqual({
      default: null,
      'pdf-client': null,
    })
    expect(gatewayService.networks).toEqual({
      'pdf-client': null,
      'pdf-upstream': null,
    })
    expect(gotenbergService.networks).toEqual({
      'pdf-upstream': null,
    })
    expect(composeConfig.networks['pdf-client']).toMatchObject({
      driver: 'bridge',
      internal: true,
    })
    expect(composeConfig.networks['pdf-upstream']).toMatchObject({
      driver: 'bridge',
    })
    expect(composeConfig.networks['pdf-upstream'].internal).not.toBe(true)
  })

  test('keeps both PDF services off host, Tailscale, Tunnel, and Funnel', () => {
    for (const service of [gatewayService, gotenbergService]) {
      expect(service.ports).toBeUndefined()
      expect(service.network_mode).not.toBe('host')
    }

    const edgeConfiguration = JSON.stringify({
      nginx: composeConfig.services.nginx,
      tunnel: composeConfig.services.tunnel,
    })
    expect(edgeConfiguration).not.toMatch(
      /pdf-gateway|gotenberg:3000|tailscale|funnel/i
    )
  })
})

describe('PDF gateway secret and runtime boundaries', () => {
  test('wires gateway policy and the LIMS credential through Docker secrets', () => {
    expect(appService.environment).toMatchObject({
      GOTENBERG_URL: 'http://pdf-gateway:8080',
      PDF_GATEWAY_TOKEN_FILE: '/run/secrets/pdf_gateway_lims_token',
    })
    expect(gatewayService.environment).toMatchObject({
      GOTENBERG_URL: 'http://gotenberg:3000',
      PDF_GATEWAY_CLIENT_POLICY_FILE:
        '/run/secrets/pdf_gateway_client_policy',
      PORT: '8080',
    })
    expect(appService.secrets).toContainEqual({
      source: 'pdf_gateway_lims_token',
      target: 'pdf_gateway_lims_token',
    })
    expect(gatewayService.secrets).toContainEqual({
      source: 'pdf_gateway_client_policy',
      target: 'pdf_gateway_client_policy',
    })
    expect(JSON.stringify(appService.environment)).not.toMatch(
      /PDF_GATEWAY_(?:TOKEN|CREDENTIAL)=/i
    )
    expect(composeConfig.secrets).toMatchObject({
      pdf_gateway_client_policy: {
        file: '/opt/lims-lite-secrets/pdf-gateway-client-policy.json',
      },
      pdf_gateway_lims_token: {
        file: '/opt/lims-lite-secrets/pdf-gateway-lims-token',
      },
    })
  })

  test('runs the gateway as a constrained non-root container', () => {
    const dockerfile = readFileSync(
      resolve(repositoryRoot, 'ops/pdf-gateway/Dockerfile'),
      'utf8'
    )

    expect(gatewayService.build).toMatchObject({
      context: resolve(repositoryRoot, 'ops/pdf-gateway'),
      dockerfile: 'Dockerfile',
    })
    expect(gatewayService.read_only).toBe(true)
    expect(gatewayService.cap_drop).toEqual(['ALL'])
    expect(gatewayService.security_opt).toContain('no-new-privileges:true')
    expect(gatewayService.init).toBe(true)
    expect(gatewayService.mem_limit).toBe('268435456')
    expect(gatewayService.mem_reservation).toBe('134217728')
    expect(gatewayService.cpus).toBe(0.5)
    expect(gatewayService.pids_limit).toBe(64)
    expect(dockerfile).toContain(
      'node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2'
    )
    expect(dockerfile).toMatch(/USER 10001:10001/)
  })

  test('bounds Chromium work and disables dynamic downloads', () => {
    expect(gotenbergService.environment).toMatchObject({
      API_DISABLE_DOWNLOAD_FROM: 'true',
      API_TIMEOUT: '30s',
      CHROMIUM_DENY_PRIVATE_IPS: 'true',
      CHROMIUM_MAX_CONCURRENCY: '2',
      CHROMIUM_MAX_QUEUE_SIZE: '4',
    })
    expect(gotenbergService.pids_limit).toBe(256)
  })

  test('documents only private gateway secret paths in the example environment', () => {
    expect(loadExampleEnvironment()).toMatchObject({
      GOTENBERG_URL: 'http://pdf-gateway:8080',
      PDF_GATEWAY_CLIENT_POLICY_FILE:
        '/opt/lims-lite-secrets/pdf-gateway-client-policy.json',
      PDF_GATEWAY_LIMS_TOKEN_FILE:
        '/opt/lims-lite-secrets/pdf-gateway-lims-token',
    })
  })
})
