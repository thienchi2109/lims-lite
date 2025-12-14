-- Migration 027: Allow analysts to start samples (change status from assigned to in_progress)

SET search_path TO public;

-- Allow analysts to update sample status from 'assigned' to 'in_progress'
CREATE POLICY "Analysts can start samples"
ON public.samples FOR UPDATE
USING (
    get_user_role() = 'analyst'
    AND status = 'assigned'
    AND deleted_at IS NULL
)
WITH CHECK (
    get_user_role() = 'analyst'
    AND status = 'in_progress'
    AND deleted_at IS NULL
);
