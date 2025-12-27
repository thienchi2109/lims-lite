'use server'

import { createClient } from '@/lib/supabase/server'
import type { TourId, TourStatus } from '@/components/walkthrough'

/**
 * Get tour completion status for a user.
 * Returns null timestamps for tours not yet completed.
 */
export async function getTourStatus(userId: string): Promise<TourStatus> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('users')
        .select('tour_accession_completed_at, tour_results_completed_at, tour_approval_completed_at')
        .eq('id', userId)
        .single()

    if (error || !data) {
        console.error('Failed to get tour status:', error)
        return {
            accession: null,
            results: null,
            approval: null,
        }
    }

    return {
        accession: data.tour_accession_completed_at ? new Date(data.tour_accession_completed_at) : null,
        results: data.tour_results_completed_at ? new Date(data.tour_results_completed_at) : null,
        approval: data.tour_approval_completed_at ? new Date(data.tour_approval_completed_at) : null,
    }
}

/**
 * Mark a specific tour as completed for a user.
 * Sets the completion timestamp to now.
 */
export async function markTourCompleted(userId: string, tourId: TourId): Promise<TourStatus | null> {
    const supabase = await createClient()

    const columnMap: Record<TourId, string> = {
        accession: 'tour_accession_completed_at',
        results: 'tour_results_completed_at',
        approval: 'tour_approval_completed_at',
    }

    const column = columnMap[tourId]
    if (!column) {
        console.error('Invalid tour ID:', tourId)
        return null
    }

    const { error } = await supabase
        .from('users')
        .update({ [column]: new Date().toISOString() })
        .eq('id', userId)

    if (error) {
        console.error('Failed to mark tour completed:', error)
        return null
    }

    // Return updated status
    return getTourStatus(userId)
}
