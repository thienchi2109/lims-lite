import { describe, expect, test } from 'vitest'
import { analyzePdfGatewayBoundarySource } from './helpers/pdf-gateway-application-boundary'

const routeFile = 'src/app/api/coa/pdf/route.ts'

describe('PDF gateway indirect application boundary', () => {
  test('rejects dynamic, CommonJS, and spread conversion calls', () => {
    const violations = analyzePdfGatewayBoundarySource(
      routeFile,
      `
        import { convertHtmlToPdf } from '@/lib/coa/pdf/gateway-client'
        const dynamicClient = await import('@/lib/coa/pdf/gateway-client')
        const commonClient = require('@/lib/coa/pdf/gateway-client')
        const args = [releasedHtml, { headers: request.headers }]

        dynamicClient.convertHtmlToPdf(releasedHtml, { url: request.url })
        commonClient.convertHtmlToPdf(releasedHtml, { url: request.url })
        convertHtmlToPdf(...args)
      `
    )

    expect(
      violations.filter(
        (violation) => violation.rule === 'direct-gateway-transport'
      ).length
    ).toBeGreaterThanOrEqual(2)
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'caller-controlled-transport' }),
      ])
    )
  })

  test('rejects namespace re-exports of the gateway client', () => {
    const violations = analyzePdfGatewayBoundarySource(
      routeFile,
      `
        export * as gatewayClient from '@/lib/coa/pdf/gateway-client'
      `
    )

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'direct-gateway-transport' }),
    ])
  })

  test('resolves imported HTTP aliases and destructured request calls', () => {
    const violations = analyzePdfGatewayBoundarySource(
      routeFile,
      `
        import * as http from 'http'
        const transport = http
        const { request: send } = http
        const hostname = 'goten' + 'berg'
        const port = 3000
        const path = ['forms', 'chromium', 'convert', 'html'].join('/')
        const options = { hostname, port, path }

        transport.request(options)
        send(options)
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ rule: 'raw-gotenberg-path' }),
      ])
    )
  })

  test('resolves CommonJS destructuring and axios factory clients', () => {
    const violations = analyzePdfGatewayBoundarySource(
      routeFile,
      `
        import axios from 'axios'
        const http = require('node:http')
        const { request: send } = http
        const raw = {
          hostname: 'goten' + 'berg',
          port: 3000,
          path: ['forms', 'chromium', 'convert', 'html'].join('/'),
        }
        send(raw)

        const client = axios.create()
        const gateway = 'http://pdf-' + 'gateway:8080/' +
          ['v1', 'convert', 'html'].join('/')
        client.post(gateway)
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'direct-gateway-transport' }),
        expect.objectContaining({ rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ rule: 'raw-gotenberg-path' }),
      ])
    )
  })

  test('keeps inner-block assignments visible through the declaration scope', () => {
    const violations = analyzePdfGatewayBoundarySource(
      routeFile,
      `
        import * as http from 'node:http'
        let hostname = 'safe.example'
        let port = 443
        let path = '/health'
        {
          hostname = 'goten' + 'berg'
          port = 3000
          path = ['forms', 'chromium', 'convert', 'html'].join('/')
        }
        http.request({ hostname, port, path })
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ rule: 'raw-gotenberg-path' }),
      ])
    )
  })

  test('does not treat a shadowing parameter as the imported HTTP client', () => {
    const violations = analyzePdfGatewayBoundarySource(
      routeFile,
      `
        import * as http from 'node:http'
        function useLocalTransport(http) {
          return http.request({
            hostname: 'goten' + 'berg',
            port: 3000,
            path: ['forms', 'chromium', 'convert', 'html'].join('/'),
          })
        }
      `
    )

    expect(violations).toEqual([])
  })

  test('tracks nested assignments from uninitialized outer declarations', () => {
    const violations = analyzePdfGatewayBoundarySource(
      routeFile,
      `
        import * as http from 'node:http'
        let hostname
        let port
        let path
        {
          hostname = 'goten' + 'berg'
          port = 3000
          path = ['forms', 'chromium', 'convert', 'html'].join('/')
        }
        http.request({ hostname, port, path })
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ rule: 'raw-gotenberg-path' }),
      ])
    )
  })

  test('inspects factory base URLs and aliased Request constructors', () => {
    const violations = analyzePdfGatewayBoundarySource(
      routeFile,
      `
        import axios from 'axios'
        const gateway = 'http://pdf-' + 'gateway:8080/' +
          ['v1', 'convert', 'html'].join('/')
        axios.create({ baseURL: gateway }).post('')

        const RequestCtor = globalThis.Request
        const raw = 'http://goten' + 'berg:' + 3000 + '/' +
          ['forms', 'chromium', 'convert', 'html'].join('/')
        fetch(new RequestCtor(raw))
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'direct-gateway-transport' }),
        expect.objectContaining({ rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ rule: 'raw-gotenberg-path' }),
      ])
    )
  })

  test('rejects renamed local re-exports derived from the gateway client', () => {
    const violations = analyzePdfGatewayBoundarySource(
      'src/lib/coa/pdf/index.ts',
      `
        import { convertHtmlToPdf } from './gateway-client'
        export { convertHtmlToPdf as convert }
      `
    )

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'direct-gateway-transport' }),
    ])
  })
})
