import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DateRange } from '@/types'

const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

import { fetchKPIData, fetchRecentSamples } from './reports'

const KPI_RPC_NAME = 'get_kpi_metrics'

function mockConsolidatedKpiResponse(data: unknown, error: unknown = null) {
  mockRpc.mockResolvedValueOnce({ data, error })
}

function expectConsolidatedKpiRpcCall(dateRange: DateRange) {
  expect(mockRpc).toHaveBeenCalledTimes(1)
  expect(mockRpc).toHaveBeenCalledWith(KPI_RPC_NAME, {
    start_date: dateRange.start,
    end_date: dateRange.end,
  })
  expect(mockRpc).not.toHaveBeenCalledWith('calculate_average_tat', expect.anything())
  expect(mockRpc).not.toHaveBeenCalledWith('get_samples_by_status', expect.anything())
  expect(mockRpc).not.toHaveBeenCalledWith('get_approval_queue_metrics', expect.anything())
  expect(mockRpc).not.toHaveBeenCalledWith('get_error_rate_metrics', expect.anything())
}

describe('fetchKPIData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockFrom.mockReset()
  })

  it('uses the consolidated KPI RPC exactly once and maps the KPI payload', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    mockConsolidatedKpiResponse([
      {
        avg_tat_hours: 48.5,
        median_tat_hours: 45,
        sample_count: 100,
        on_time_count: 85,
        status_breakdown: [
          { status: 'received', count: 20 },
          { status: 'assigned', count: 10 },
          { status: 'in_progress', count: 15 },
          { status: 'review', count: 5 },
          { status: 'completed', count: 50 },
        ],
        pending_count: 15,
        avg_wait_hours: 12,
        overdue_count: 2,
        error_rate: 2.5,
        total_modifications: 10,
        total_results: 400,
      },
    ])

    const result = await fetchKPIData(dateRange)

    expectConsolidatedKpiRpcCall(dateRange)

    expect(result.avgTAT.value).toBe(48.5)
    expect(result.wipCount.value).toBe(50)
    expect(result.wipCount.breakdown).toEqual([
      { status: 'received', count: 20 },
      { status: 'assigned', count: 10 },
      { status: 'in_progress', count: 15 },
      { status: 'review', count: 5 },
      { status: 'completed', count: 50 },
    ])
    expect(result.pendingApprovals).toEqual({
      count: 15,
      avgWaitHours: 12,
      overdueCount: 2,
      isAlert: false,
    })
    expect(result.onTimeRate.value).toBe(85)
    expect(result.errorRate).toEqual({
      value: 2.5,
      totalModifications: 10,
      totalResults: 400,
      trend: 0,
    })
  })

  it('returns zeroed KPI metrics when the consolidated RPC returns no rows', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-02T00:00:00Z',
    }

    mockConsolidatedKpiResponse([])

    const result = await fetchKPIData(dateRange)

    expectConsolidatedKpiRpcCall(dateRange)

    expect(result.avgTAT.value).toBe(0)
    expect(result.wipCount.value).toBe(0)
    expect(result.wipCount.breakdown).toEqual([])
    expect(result.pendingApprovals).toEqual({
      count: 0,
      avgWaitHours: 0,
      overdueCount: 0,
      isAlert: false,
    })
    expect(result.onTimeRate.value).toBe(0)
    expect(result.errorRate).toEqual({
      value: 0,
      totalModifications: 0,
      totalResults: 0,
      trend: 0,
    })
  })

  it('throws consolidated-RPC failures instead of returning partial KPI data', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    mockConsolidatedKpiResponse(null, { message: 'RPC function not found' })

    await expect(fetchKPIData(dateRange)).rejects.toThrow('RPC function not found')

    expectConsolidatedKpiRpcCall(dateRange)
  })

  it('throws when the consolidated KPI payload is malformed', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    mockConsolidatedKpiResponse([
      {
        avg_tat_hours: 48.5,
        sample_count: 'bad-number',
        on_time_count: 85,
        status_breakdown: 'bad-breakdown',
        pending_count: 15,
        avg_wait_hours: 12,
        overdue_count: 2,
        error_rate: 2.5,
        total_modifications: 10,
        total_results: 400,
      },
    ])

    await expect(fetchKPIData(dateRange)).rejects.toThrow('Malformed KPI metrics payload')

    expectConsolidatedKpiRpcCall(dateRange)
  })
})

describe('fetchRecentSamples', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockFrom.mockReset()
  })

  it('omits samples with unrecognized status values instead of crashing reports fetch', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }
    const query = createSamplesQueryMock({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          sample_id: 'S-001',
          client_name: 'Client A',
          received_at: '2024-12-01T00:00:00Z',
          completed_at: null,
          status: 'received',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          sample_id: 'S-002',
          client_name: 'Client B',
          received_at: '2024-12-02T00:00:00Z',
          completed_at: null,
          status: 'archived',
        },
      ],
      error: null,
      count: 2,
    })
    mockFrom.mockReturnValue(query)

    try {
      const result = await fetchRecentSamples(dateRange)

      expect(result.total).toBe(2)
      expect(result.samples).toHaveLength(1)
      expect(result.samples[0].status).toBe('received')
      expect(consoleWarn).toHaveBeenCalledWith(
        '[reports] Dropped sample with invalid status from recent samples',
        expect.objectContaining({ sampleId: 'S-002', status: 'archived' })
      )
    } finally {
      consoleWarn.mockRestore()
    }
  })
})

function createSamplesQueryMock(response: unknown) {
  const query = {
    select: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: vi.fn((resolve) => Promise.resolve(response).then(resolve)),
  }
  return query
}
