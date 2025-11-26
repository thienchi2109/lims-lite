-- CDC-LIMS Audit Trail Triggers
-- Migration 002: Audit Triggers
-- Implements automatic audit logging for compliance

-- Set search path to ensure we're in the right schema
SET search_path TO public;

-- ============================================================================
-- AUDIT TRAIL TRIGGER FUNCTION (Generic)
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_audit_log()
RETURNS TRIGGER AS $$
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
            to_jsonb(OLD),
            to_jsonb(NEW),
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
            to_jsonb(NEW),
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
            to_jsonb(OLD),
            auth.uid()
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- APPLY AUDIT TRIGGERS TO CRITICAL TABLES
-- ============================================================================

-- Audit trigger for samples table
CREATE TRIGGER audit_samples_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.samples
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Audit trigger for results table (CRITICAL for compliance)
CREATE TRIGGER audit_results_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.results
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Audit trigger for users table
CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION trigger_audit_log() IS 'Generic audit trail function for 21 CFR Part 11 compliance';
