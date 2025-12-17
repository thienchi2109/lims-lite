-- Migration 070: Update audit trigger to exclude search_vector
-- Description: Excludes search_vector from audit log change diffs to reduce noise

SET search_path TO public;

-- Update audit trigger function to exclude search_vector from change tracking
-- This prevents automatic search_vector updates from creating noisy audit entries
CREATE OR REPLACE FUNCTION public.trigger_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
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
            to_jsonb(OLD) - 'search_vector',  -- Exclude search_vector
            to_jsonb(NEW) - 'search_vector',  -- Exclude search_vector
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
