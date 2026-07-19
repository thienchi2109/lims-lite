/**
 * Locks the application-side boundary between LIMS and the authenticated PDF
 * gateway without scanning the separately owned gateway server implementation.
 */
import { describe, expect, test } from 'vitest'
import {
  analyzePdfGatewayBoundarySource,
  findPdfGatewayApplicationBoundaryViolations,
} from './helpers/pdf-gateway-application-boundary'

describe('PDF gateway application source boundary', () => {
  test('detects raw Gotenberg hosts and conversion paths', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        fetch('http://gotenberg:3000/forms/chromium/convert/html')
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file, rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ file, rule: 'raw-gotenberg-path' }),
      ])
    )
  })
  test('detects callers that try to supply transport configuration', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import { convertHtmlToPdf } from '@/lib/coa/pdf/gateway-client'
        await convertHtmlToPdf(releasedHtml, {
          headers: request.headers,
          url: process.env.GOTENBERG_URL,
        })
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file,
          rule: 'caller-controlled-transport',
        }),
      ])
    )
  })
  test('detects raw endpoints assembled from constant expressions', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        const service = 'goten' + 'berg'
        const port = 3000
        const path = ['forms', 'chromium', 'convert', 'html'].join('/')
        await fetch(\`http://\${service}:\${port}/\${path}\`)
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ rule: 'raw-gotenberg-path' }),
      ])
    )
  })
  test('resolves aliased imports and transport objects held in variables', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import { convertHtmlToPdf as convert } from '@/lib/coa/pdf/gateway-client'
        const transport = {
          html: releasedHtml,
          headers: request.headers,
          url: 'https://converter.invalid',
        }
        await convert(transport)
      `
    )

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'caller-controlled-transport' }),
    ])
  })
  test('resolves namespace, computed, indirect, and spread transport calls', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import * as gatewayClient from '@/lib/coa/pdf/gateway-client'
        const convert = gatewayClient['convertHtmlToPdf']
        const transport = { headers: request.headers, url: request.url }
        await convert({ html: releasedHtml, ...transport })
      `
    )

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'caller-controlled-transport' }),
    ])
  })
  test('detects direct gateway transport outside the client module', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        const gateway = process.env.GOTENBERG_URL
        await fetch(\`\${gateway}/v1/convert/html\`, {
          headers: { Authorization: \`Bearer \${gatewayToken}\` },
        })
      `
    )

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'direct-gateway-transport' }),
    ])
  })
  test('resolves constants at the usage scope instead of later shadows', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        const host = 'goten' + 'berg'
        const port = 3000
        const path = ['forms', 'chromium', 'convert', 'html'].join('/')
        fetch(\`http://\${host}:\${port}/\${path}\`)

        function unrelated() {
          const host = 'safe.example'
          const port = 443
          const path = '/health'
          return { host, port, path }
        }
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ rule: 'raw-gotenberg-path' }),
      ])
    )
  })

  test('detects computed gateway URLs through fetch aliases and Request', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        const host = 'pdf-' + 'gateway'
        const port = 8080
        const path = ['v1', 'convert', 'html'].join('/')
        const endpoint = \`http://\${host}:\${port}/\${path}\`
        const send = globalThis.fetch
        const gatewayRequest = new Request(endpoint)
        await send(gatewayRequest)
      `
    )

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'direct-gateway-transport' }),
    ])
  })

  test('detects object-form raw requests and gateway-server imports', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import * as http from 'node:http'
        import { createPdfGatewayServer } from '@/lib/pdf-gateway/server'
        http.request({
          hostname: 'goten' + 'berg',
          port: 3000,
          path: ['forms', 'chromium', 'convert', 'html'].join('/'),
        })
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

  test('handles namespace destructuring and indirect call forms', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import * as gatewayClient from '@/lib/coa/pdf/gateway-client.ts'
        const { convertHtmlToPdf: convert } = gatewayClient
        convert.call(undefined, releasedHtml, { url: request.url })
        convert.apply(undefined, [releasedHtml, { headers: request.headers }])
      `
    )

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'caller-controlled-transport' }),
      expect.objectContaining({ rule: 'caller-controlled-transport' }),
    ])
  })

  test('rejects conversion imports routed through an unapproved barrel', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import { convertHtmlToPdf as convert } from '@/lib/coa/pdf'
        await convert(releasedHtml)
      `
    )

    expect(violations).toEqual([
      expect.objectContaining({ rule: 'direct-gateway-transport' }),
    ])
  })

  test('does not treat an unrelated local function as the gateway client', () => {
    const file = 'src/lib/local-converter.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        function convertHtmlToPdf(input, options) {
          return { input, options }
        }
        convertHtmlToPdf(html, { url: 'https://converter.invalid' })
      `
    )

    expect(violations).toEqual([])
  })

  test('handles CommonJS, shorthand, spread, and qualified Request forms', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        const http = require('http')
        const hostname = 'goten' + 'berg'
        const port = 3000
        const path = ['forms', 'chromium', 'convert', 'html'].join('/')
        const target = { hostname, port, path }
        http.request({ ...target })

        const gatewayHost = 'pdf-' + 'gateway'
        const gatewayPath = ['v1', 'convert', 'html'].join('/')
        const endpoint = \`http://\${gatewayHost}:8080/\${gatewayPath}\`
        globalThis.fetch(new globalThis.Request(endpoint))
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

  test('rejects barrel members and dynamic gateway-server references', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import pdfDefault from '@/lib/coa/pdf'
        import * as pdf from '@/lib/coa/pdf'
        export { convertHtmlToPdf } from '@/lib/coa/pdf/gateway-client'

        pdf.convertHtmlToPdf(releasedHtml)
        pdfDefault.convertHtmlToPdf(releasedHtml)
        void import('@/lib/pdf-gateway/server')
        const gatewayServer = require('@/lib/pdf-gateway/server')
      `
    )

    expect(
      violations.filter(
        (violation) => violation.rule === 'direct-gateway-transport'
      ).length
    ).toBeGreaterThanOrEqual(4)
  })

  test('resolves endpoint and conversion alias assignment writes', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import * as gatewayClient from '@/lib/coa/pdf/gateway-client'
        let endpoint = 'https://safe.example'
        endpoint = 'http://goten' + 'berg:' + 3000 + '/' +
          ['forms', 'chromium', 'convert', 'html'].join('/')
        fetch(endpoint)

        let convert = safeConverter
        convert = gatewayClient.convertHtmlToPdf
        convert(releasedHtml, { headers: request.headers })
      `
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'caller-controlled-transport' }),
        expect.objectContaining({ rule: 'raw-gotenberg-host' }),
        expect.objectContaining({ rule: 'raw-gotenberg-path' }),
      ])
    )
  })

  test('handles computed call while respecting parameter shadowing', () => {
    const file = 'src/app/api/coa/pdf/route.ts'
    const violations = analyzePdfGatewayBoundarySource(
      file,
      `
        import { convertHtmlToPdf } from '@/lib/coa/pdf/gateway-client'
        convertHtmlToPdf['call'](
          undefined,
          releasedHtml,
          { url: request.url }
        )

        function useLocalConverter(convertHtmlToPdf) {
          return convertHtmlToPdf(releasedHtml, { url: request.url })
        }
      `
    )

    expect(
      violations.filter(
        (violation) => violation.rule === 'caller-controlled-transport'
      )
    ).toEqual([
      expect.objectContaining({
        line: 3,
        rule: 'caller-controlled-transport',
      }),
    ])
  })

  test('keeps current application source behind the authenticated client', () => {
    expect(findPdfGatewayApplicationBoundaryViolations()).toEqual([])
  })
})
