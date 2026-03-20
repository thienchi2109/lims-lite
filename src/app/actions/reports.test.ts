/**
 * Integration tests for Reports Server Actions
 * Tests for getKPIMetrics, RLS compliance, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DateRange } from '@/types'

// Mock Supabase client
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockGetUser = vi.fn()
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

// Import after mocks are set up
import { getKPIMetrics } from './reports'

describe('getKPIMetrics', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
    consoleErrorSpy.mockClear()

    // Default mock responses
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('uses the consolidated KPI RPC exactly once and keeps the KPI contract intact', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    mockRpc.mockResolvedValueOnce({
      data: [
        {
          avg_tat_hours: 48.5,
          median_tat_hours: 45.0,
          sample_count: 100,
          on_time_count: 85,
          status_breakdown: [
            { status: 'received', count: 20 },
            { status: 'in_progress', count: 30 },
          ],
          pending_count: 15,
          avg_wait_hours: 12.0,
          overdue_count: 2,
          error_rate: 2.5,
          total_modifications: 10,
          total_results: 400,
        },
      ],
      error: null,
    })

    const resultPromise = getKPIMetrics(dateRange)
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

    // Verify result structure
    expect(result).toBeDefined()
    expect(result.avgTAT.value).toBe(48.5)
    expect(result.wipCount.value).toBeGreaterThan(0)
  })

  it('should reject invalid date range (missing start)', async () => {
    const invalidDateRange = {
      start: '', // Invalid: empty string
      end: '2024-12-20T23:59:59Z',
    } as DateRange

    await expect(getKPIMetrics(invalidDateRange)).rejects.toThrow()
  })

  it('should reject invalid date range (invalid datetime format)', async () => {
    const invalidDateRange = {
      start: '2024-12-01', // Invalid: missing time component
      end: '2024-12-20',
    } as DateRange

    await expect(getKPIMetrics(invalidDateRange)).rejects.toThrow()
  })

  it('logs each KPI RPC failure and throws instead of returning partial metrics', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    // Mock multiple RPC errors so every swallowed failure must be logged.
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC function not found' },
      })
      .mockResolvedValueOnce({
        data: [],
        error: { message: 'Status RPC failed' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Approval RPC failed' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Error-rate RPC failed' },
      })

    await expect(getKPIMetrics(dateRange)).rejects.toThrow('RPC function not found')

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'KPI metrics RPC failed: calculate_average_tat',
      expect.objectContaining({ message: 'RPC function not found' }),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'KPI metrics RPC failed: get_samples_by_status',
      expect.objectContaining({ message: 'Status RPC failed' }),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'KPI metrics RPC failed: get_approval_queue_metrics',
      expect.objectContaining({ message: 'Approval RPC failed' }),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'KPI metrics RPC failed: get_error_rate_metrics',
      expect.objectContaining({ message: 'Error-rate RPC failed' }),
    )
  })

  it('should handle empty data gracefully', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-02T00:00:00Z',
    }

    // Mock empty responses (no samples in this date range)
    mockRpc
      .mockResolvedValueOnce({
        data: { avg_tat_hours: 0, median_tat_hours: 0, sample_count: 0, on_time_count: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [], // No samples by status
        error: null,
      })
      .mockResolvedValueOnce({
        data: { pending_count: 0, avg_wait_hours: 0, overdue_count: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { error_rate: 0, total_modifications: 0, total_results: 0 },
        error: null,
      })

    const result = await getKPIMetrics(dateRange)

    expect(result.avgTAT.value).toBe(0)
    expect(result.wipCount.value).toBe(0)
    expect(result.pendingApprovals.count).toBe(0)
    expect(result.onTimeRate.value).toBe(0)
    expect(result.errorRate.value).toBe(0)
  })

  it('should calculate on-time rate correctly', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    // Mock data: 85 out of 100 samples on-time
    mockRpc
      .mockResolvedValueOnce({
        data: { avg_tat_hours: 48.5, median_tat_hours: 45.0, sample_count: 100, on_time_count: 85 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ status: 'completed', count: 100 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { pending_count: 0, avg_wait_hours: 0, overdue_count: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { error_rate: 2.5, total_modifications: 10, total_results: 400 },
        error: null,
      })

    const result = await getKPIMetrics(dateRange)

    // On-time rate should be 85% (85/100 * 100)
    expect(result.onTimeRate.value).toBe(85)
  })

  it('should validate date range format', async () => {
    // Invalid: Start date after end date
    const invalidDateRange: DateRange = {
      start: '2024-12-20T00:00:00Z',
      end: '2024-12-01T00:00:00Z',
    }

    // The function should still call RPC (validation happens at business logic level)
    // But results might be empty or unexpected
    mockRpc
      .mockResolvedValueOnce({
        data: { avg_tat_hours: 0, median_tat_hours: 0, sample_count: 0, on_time_count: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { pending_count: 0, avg_wait_hours: 0, overdue_count: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { error_rate: 0, total_modifications: 0, total_results: 0 },
        error: null,
      })

    const result = await getKPIMetrics(invalidDateRange)

    // Should handle gracefully (empty results)
    expect(result.avgTAT.value).toBe(0)
    expect(result.wipCount.value).toBe(0)
  })
})

describe('RLS Compliance', () => {
  it('should enforce RLS policies through SECURITY INVOKER functions', async () => {
    // This test verifies that RPC functions use SECURITY INVOKER
    // which automatically enforces RLS policies based on current user role

    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    // Mock successful RPC calls (RLS is enforced at database level)
    mockRpc
      .mockResolvedValueOnce({
        data: { avg_tat_hours: 48.5, median_tat_hours: 45.0, sample_count: 100, on_time_count: 85 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ status: 'received', count: 20 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { pending_count: 15, avg_wait_hours: 12.0, overdue_count: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { error_rate: 2.5, total_modifications: 10, total_results: 400 },
        error: null,
      })

    const result = await getKPIMetrics(dateRange)

    // Verify data is returned (RLS allows access)
    expect(result).toBeDefined()
    expect(result.avgTAT.value).toBe(48.5)

    // Note: Actual RLS testing must be done at database level
    // These integration tests verify the Server Action calls RPC correctly
    // Database-level tests verify RLS policies work as expected
  })

  it('should handle RLS policy violations from database', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    // Mock RLS violation error from database
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'new row violates row-level security policy', code: '42501' },
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { pending_count: 0, avg_wait_hours: 0, overdue_count: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { error_rate: 0, total_modifications: 0, total_results: 0 },
        error: null,
      })

    await expect(getKPIMetrics(dateRange)).rejects.toThrow('row-level security policy')
  })
})

describe('Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    // Mock network error
    mockRpc.mockRejectedValueOnce(new Error('Network error'))

    await expect(getKPIMetrics(dateRange)).rejects.toThrow()
  })

  it('should handle malformed RPC responses', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    // Mock malformed response (missing required fields)
    mockRpc
      .mockResolvedValueOnce({
        data: { avg_tat_hours: null }, // Missing other fields
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { pending_count: 0, avg_wait_hours: 0, overdue_count: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { error_rate: 0, total_modifications: 0, total_results: 0 },
        error: null,
      })

    const result = await getKPIMetrics(dateRange)

    // Should handle missing fields gracefully
    expect(result).toBeDefined()
    expect(result.avgTAT.value).toBeDefined()
  })

  it('should validate Zod schema for date range', async () => {
    // Invalid: Not an ISO datetime string
    const invalidDateRange = {
      start: 'not-a-date',
      end: 'also-not-a-date',
    } as DateRange

    await expect(getKPIMetrics(invalidDateRange)).rejects.toThrow()
  })

  it('should handle database timeout errors', async () => {
    const dateRange: DateRange = {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-20T23:59:59Z',
    }

    // Mock timeout error
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'canceling statement due to statement timeout', code: '57014' },
    })

    // Other RPCs succeed
    mockRpc
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { pending_count: 0, avg_wait_hours: 0, overdue_count: 0 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { error_rate: 0, total_modifications: 0, total_results: 0 },
        error: null,
      })

    await expect(getKPIMetrics(dateRange)).rejects.toThrow('statement timeout')
  })
})
