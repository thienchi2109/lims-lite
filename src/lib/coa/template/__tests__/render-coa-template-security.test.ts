import { describe, expect, it } from 'vitest'

import type { CoAData } from '@/types'
import { renderCoATemplate } from '../index'

function createMaliciousCoAData(): CoAData {
  return {
    sample: {
      id: '11111111-1111-1111-1111-111111111111',
      sample_id_display: 'SAMPLE-<img src=x onerror=alert(1)>',
      approved_by: '22222222-2222-2222-2222-222222222222',
      approved_at: '2026-03-21T00:00:00.000Z',
      client_name: '<script>alert("client")</script>',
      sample_type: '" onclick="alert(2)',
      received_date: '2026-03-20T00:00:00.000Z',
      client_dob: '2000-01-01',
      client_gender: 'Nam',
      client_address: '<img src=x onerror=alert("address")>',
      client_health_insurance_num: 'BHYT-" onmouseover="alert(3)',
    },
    results: [
      {
        assay_name: '<svg onload=alert("assay")>',
        value: '<b>positive</b>',
        unit: 'mg/L',
        normal_range: '<i>0-5</i>',
        method_name: '<script>alert("method")</script>',
        lab_specialty_name: 'Huyết học',
      },
    ],
    approverName: '<img src=x onerror=alert("approver")>',
    approverSignature: 'https://example.com/signature.png" onerror="alert(4)',
    signatureId: '33333333-3333-3333-3333-333333333333',
    approvalDate: '21/03/2026',
    testingDate: '2026-03-19T00:00:00.000Z',
    manualInputs: {
      referrer: '<script>alert("referrer")</script>',
      sampleQuality: 'Tốt',
    },
    performerName: '<b>Tech</b>',
    performerSignature: 'https://example.com/performer.png" onload="alert(5)',
    performerSignatureId: '44444444-4444-4444-4444-444444444444',
    performerSignatureMeaning: 'submitted',
  }
}

describe('renderCoATemplate security', () => {
  it('escapes dynamic values so malicious HTML renders as text', () => {
    const html = renderCoATemplate(createMaliciousCoAData())

    expect(html).toContain('SAMPLE-&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('&lt;script&gt;alert(&quot;client&quot;)&lt;/script&gt;')
    expect(html).toContain('&quot; onclick=&quot;alert(2)')
    expect(html).toContain('&lt;img src=x onerror=alert(&quot;address&quot;)&gt;')
    expect(html).toContain('&lt;svg onload=alert(&quot;assay&quot;)&gt;')
    expect(html).toContain('&lt;b&gt;positive&lt;/b&gt;')
    expect(html).toContain('&lt;script&gt;alert(&quot;method&quot;)&lt;/script&gt;')
    expect(html).toContain('KTV. &lt;b&gt;Tech&lt;/b&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(&quot;approver&quot;)&gt;')
    expect(html).toContain('data=SAMPLE-%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E')
    expect(html).not.toContain('<script>alert("client")</script>')
    expect(html).not.toContain('onerror=alert(1)>')
    expect(html).not.toContain('" onload="alert(5)')
  })

  it('renders the manager stamp over the approver signature when provided', () => {
    const html = renderCoATemplate(createMaliciousCoAData(), {
      managerStampSrc: 'data:image/svg+xml;base64,stamp-data',
    })

    expect(html).toContain('class="manager-signature-stack"')
    expect(html).toContain(
      '<img src="data:image/svg+xml;base64,stamp-data" alt="Con dấu" class="manager-stamp-image" data-coa-stamp="manager" />',
    )
    expect(html).toContain('alt="Chữ ký" class="signature-image manager-signature-image"')
    expect(html).not.toContain('data-coa-stamp="performer"')
  })

  it('includes manager stamp overlay styles', () => {
    const html = renderCoATemplate(createMaliciousCoAData(), {
      managerStampSrc: 'data:image/svg+xml;base64,stamp-data',
    })

    expect(html).toContain('.manager-signature-stack { position: relative;')
    expect(html).toContain('.manager-signature-image { margin: 0 auto 8px auto;')
    expect(html).toContain('.manager-stamp-image {')
    expect(html).toContain('position: absolute;')
    expect(html).toContain('left: -156px;')
    expect(html).toContain('width: 240px;')
    expect(html).toContain('z-index: 2;')
    expect(html).not.toContain('z-index: 999')
  })
})
