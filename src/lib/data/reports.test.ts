import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DateRange } from '@/types'

const mockRpc = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

import { fetchKPIData } from './reports'

describe('fetchKPIData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('uses the consolidated KPI RPC exactly once and maps the KPI payload', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    mockRpc.mockResolvedValueOnce({
      data: [
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
      ],
      error: null,
    })

    const resultPromise = fetchKPIData(dateRange)
    void resultPromise.catch(() => undefined)
    await Promise.resolve()

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'get_kpi_metrics', {
      start_date: dateRange.start,
      end_date: dateRange.end,
    })
    expect(mockRpc).not.toHaveBeenCalledWith('calculate_average_tat', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_samples_by_status', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_approval_queue_metrics', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_error_rate_metrics', expect.anything())

    const result = await resultPromise

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

    mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    })

    const resultPromise = fetchKPIData(dateRange)
    void resultPromise.catch(() => undefined)
    await Promise.resolve()

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'get_kpi_metrics', {
      start_date: dateRange.start,
      end_date: dateRange.end,
    })
    expect(mockRpc).not.toHaveBeenCalledWith('calculate_average_tat', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_samples_by_status', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_approval_queue_metrics', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_error_rate_metrics', expect.anything())

    const result = await resultPromise

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

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC function not found' },
    })

    const resultPromise = fetchKPIData(dateRange)
    void resultPromise.catch(() => undefined)
    await Promise.resolve()

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'get_kpi_metrics', {
      start_date: dateRange.start,
      end_date: dateRange.end,
    })
    expect(mockRpc).not.toHaveBeenCalledWith('calculate_average_tat', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_samples_by_status', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_approval_queue_metrics', expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith('get_error_rate_metrics', expect.anything())

    await expect(resultPromise).rejects.toThrow('RPC function not found')
  })
})
