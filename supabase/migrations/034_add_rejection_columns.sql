-- Migration 034: Add rejection tracking columns to samples table
-- Description: Adds columns to track rejection/discard reason, time, and user.

SET search_path TO public;

ALTER TABLE public.samples ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.samples ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.samples ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.users(id);

COMMENT ON COLUMN public.samples.rejection_reason IS 'Reason provided by manager when rejecting or discarding sample';
COMMENT ON COLUMN public.samples.rejected_at IS 'Timestamp when the sample was rejected or discarded';
COMMENT ON COLUMN public.samples.rejected_by IS 'User ID of the manager who rejected or discarded the sample';
