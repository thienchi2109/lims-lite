'use client'

/**
 * useAssignTests Hook
 * 
 * TanStack Query mutation hook for assigning tests to a sample.
 * Implements optimistic updates and automatic cache invalidation.
 * 
 * Features:
 * - Optimistic UI updates (instant feedback)
 * - Automatic cache invalidation on success
 * - Rollback on error
 * - Toast notifications
 * 
 * @example
 * const { mutate, isPending } = useAssignTests({
 *   onSuccess: () => {
 *     toast.success('Đã chỉ định xét nghiệm thành công')
 *   }
 * })
 * 
 * mutate({
 *   sampleId: 'uuid',
 *   tests: [{ assayId: 'uuid', methodId: 'uuid' }]
 * })
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assignTestsClient } from '@/lib/api-client'
import { sampleKeys } from '@/types/query-keys'
import type { AssignTests, SampleWithUser } from '@/types'
import { toast } from 'sonner'

interface UseAssignTestsOptions {
    /**
     * Callback fired on successful mutation
     */
    onSuccess?: () => void

    /**
     * Callback fired on mutation error
     */
    onError?: (error: Error) => void

    /**
     * Enable optimistic updates
     * Default: true
     */
    optimistic?: boolean
}

export function useAssignTests(options: UseAssignTestsOptions = {}) {
    const queryClient = useQueryClient()
    const { onSuccess, onError, optimistic = true } = options

    return useMutation({
        mutationFn: async (data: AssignTests) => {
            const result = await assignTestsClient(data)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result
        },

        // Optimistic update: Immediately update cache before server responds
        onMutate: async (variables) => {
            if (!optimistic) return

            // Cancel any outgoing refetches to avoid overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: sampleKeys.detail(variables.sampleId) })
            await queryClient.cancelQueries({ queryKey: sampleKeys.all })

            // Snapshot the previous value for rollback
            const previousSample = queryClient.getQueryData<SampleWithUser | undefined>(
                sampleKeys.detail(variables.sampleId)
            )

            // Optimistically update sample status to 'assigned'
            queryClient.setQueryData<SampleWithUser | undefined>(
                sampleKeys.detail(variables.sampleId),
                (old) => {
                    if (!old) return old
                    return {
                        ...old,
                        status: 'assigned',
                        updated_at: new Date().toISOString(),
                    }
                }
            )

            // Return context with previous value for rollback
            return { previousSample }
        },

        // On error: Roll back optimistic update
        onError: (error, variables, context) => {
            // Rollback to previous value
            if (context?.previousSample) {
                queryClient.setQueryData(sampleKeys.detail(variables.sampleId), context.previousSample)
            }

            // Show error toast
            toast.error(error.message || 'Không thể chỉ định xét nghiệm')

            // Call custom error handler
            onError?.(error as Error)
        },

        // On success: Invalidate queries to refetch fresh data
        onSuccess: (data, variables) => {
            // Invalidate all samples queries to trigger refetch
            // This ensures the samples list updates with new status
            queryClient.invalidateQueries({ queryKey: sampleKeys.all })

            // Invalidate specific sample detail
            queryClient.invalidateQueries({ queryKey: sampleKeys.detail(variables.sampleId) })

            // Invalidate sample tests
            queryClient.invalidateQueries({ queryKey: sampleKeys.tests(variables.sampleId) })

            // Show success toast
            toast.success('Đã chỉ định xét nghiệm thành công')

            // Call custom success handler
            onSuccess?.()
        },
    })
}
