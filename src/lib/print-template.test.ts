import { describe, expect, it } from 'vitest'

import { generatePrintTemplate } from './print-template'
import type { ResultWithAssay, SampleWithUser } from '@/types'

describe('generatePrintTemplate', () => {
  it('renders the test-order table without the selection column', () => {
    const sample = {
      id: 'sample-1',
      sample_id: 'S-001',
      client_name: 'Nguyen Van A',
      sample_type: 'Máu',
      sample_quality: null,
    } as SampleWithUser
    const results = [
      {
        id: 'result-1',
        assay_name: 'Glucose',
      },
    ] as ResultWithAssay[]

    const html = generatePrintTemplate(sample, results, '08/07/2026')

    expect(html).not.toContain('>Chọn</th>')
    expect(html).not.toContain('checkbox-cell')
    expect(html).not.toContain('☐')
    expect(html).toContain('<th width="5%" class="center-text">STT</th>')
    expect(html).toContain('<th width="20%" class="center-text">Mã XN</th>')
    expect(html).toContain('<th width="45%">Tên Xét Nghiệm / Protocol</th>')
    expect(html).toContain('<th width="30%">Ghi Chú</th>')
    expect(html).toMatch(/<td colspan="4">[^<]+<\/td>/)
  })

  it('renders the sample code as a bordered barcode instead of a header QR code', () => {
    const sample = {
      id: 'sample-1',
      sample_id: 'S-001',
      client_name: 'Nguyen Van A',
      sample_type: 'Máu',
      sample_quality: null,
    } as SampleWithUser

    const html = generatePrintTemplate(sample, [], '08/07/2026')

    expect(html).not.toContain('create-qr-code/?size=150x150&data=S-001')
    expect(html).not.toContain('class="qr-img" alt="QR Code"')
    expect(html).toContain('class="sample-barcode-box"')
    expect(html).toContain('border: 1px solid #94a3b8')
    expect(html).toContain('aria-label="Barcode S-001"')
    expect(html).toContain('<div class="sample-id-box">S-001</div>')
  })

  it.each([
    [true, 'Đạt'],
    [false, 'Không đạt'],
    [null, 'Chưa đánh giá'],
  ] as const)(
    'renders persisted sample quality %s in the existing receipt row',
    (sampleQuality, expectedLabel) => {
      const sample = {
        id: 'sample-1',
        sample_id: 'S-001',
        client_name: 'Nguyen Van A',
        type: 'Máu',
        received_at: '2026-07-21T08:30:00.000Z',
        received_by_name: 'Nguyễn Thiện Chí',
        sample_quality: sampleQuality,
      } as SampleWithUser

      const html = generatePrintTemplate(sample, [], '21/07/2026')
      const document = new DOMParser().parseFromString(html, 'text/html')
      const qualityLabelCell = Array.from(
        document.querySelectorAll<HTMLTableCellElement>('td.info-label'),
      ).find((cell) => cell.textContent?.trim() === 'Chất lượng mẫu:')
      const receiptRow = qualityLabelCell?.closest('tr')
      const cells = Array.from(receiptRow?.querySelectorAll('td') ?? [])

      expect(receiptRow).not.toBeNull()
      expect(cells).toHaveLength(6)
      expect(cells.map((cell) => cell.textContent?.trim())).toEqual([
        'Thời gian nhận:',
        expect.any(String),
        'Người nhận:',
        'Nguyễn Thiện Chí',
        'Chất lượng mẫu:',
        expectedLabel,
      ])
      expect(cells[3]?.hasAttribute('colspan')).toBe(false)
    },
  )
})
