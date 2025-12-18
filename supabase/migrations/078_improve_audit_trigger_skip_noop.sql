-- Migration 078: Improve audit trigger to skip no-op updates
-- Security Impact: Low - Improves audit log quality without changing security model
-- Description: Updates the audit trigger to skip logging when only search_vector changed
--              AND when old_values equals new_values after excluding search_vector.
--              This prevents future backfills or automated updates from polluting audit logs.

SET search_path TO public;

-- Update audit trigger function to skip no-op updates
CREATE OR REPLACE FUNCTION public.trigger_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    old_data JSONB;
    new_data JSONB;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Exclude search_vector from comparison
        old_data := to_jsonb(OLD) - 'search_vector';
        new_data := to_jsonb(NEW) - 'search_vector';

        -- Skip logging if no meaningful changes occurred
        IF old_data = new_data THEN
            RETURN NEW;
        END IF;

        -- Log the meaningful change
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            operation,
            old_values,
            new_values,
            changed_by
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id,
            TG_OP,
            old_data,
            new_data,
            auth.uid()
        );
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            operation,
            new_values,
            changed_by
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id,
            TG_OP,
            to_jsonb(NEW) - 'search_vector',  -- Exclude search_vector
            auth.uid()
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            operation,
            old_values,
            changed_by
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id,
            TG_OP,
            to_jsonb(OLD) - 'search_vector',  -- Exclude search_vector
            auth.uid()
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION trigger_audit_log() IS 'Generic audit trail function for 21 CFR Part 11 compliance - skips no-op updates where only search_vector changed';
