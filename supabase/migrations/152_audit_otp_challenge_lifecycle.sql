-- Migration 152: Audit OTP challenge lifecycle without OTP material
-- Security Impact: Medium
-- Adds audit coverage for OTP challenge create/use/lock lifecycle metadata.
-- Plaintext OTP values are never stored in manager_otp_challenges; this audit
-- trigger also excludes code_hash to avoid copying verifier material.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.audit_manager_otp_challenge_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_old_values := jsonb_build_object(
            'id', OLD.id,
            'user_id', OLD.user_id,
            'session_id_hash', encode(digest(OLD.session_id, 'sha256'), 'hex'),
            'expires_at', OLD.expires_at,
            'resend_available_at', OLD.resend_available_at,
            'attempt_count', OLD.attempt_count,
            'used_at', OLD.used_at,
            'locked_at', OLD.locked_at,
            'created_at', OLD.created_at
        );
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_new_values := jsonb_build_object(
            'id', NEW.id,
            'user_id', NEW.user_id,
            'session_id_hash', encode(digest(NEW.session_id, 'sha256'), 'hex'),
            'expires_at', NEW.expires_at,
            'resend_available_at', NEW.resend_available_at,
            'attempt_count', NEW.attempt_count,
            'used_at', NEW.used_at,
            'locked_at', NEW.locked_at,
            'created_at', NEW.created_at
        );
    END IF;

    IF TG_OP = 'UPDATE' AND v_old_values = v_new_values THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_by
    )
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        v_old_values,
        v_new_values,
        auth.uid()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_manager_otp_challenge_lifecycle()
IS 'Audits OTP challenge lifecycle metadata while excluding plaintext OTP values and code_hash verifier material.';

DROP TRIGGER IF EXISTS audit_manager_otp_challenge_lifecycle ON public.manager_otp_challenges;
CREATE TRIGGER audit_manager_otp_challenge_lifecycle
AFTER INSERT OR UPDATE OR DELETE ON public.manager_otp_challenges
FOR EACH ROW
EXECUTE FUNCTION public.audit_manager_otp_challenge_lifecycle();

CREATE OR REPLACE FUNCTION public.test_otp_challenge_lifecycle_audit()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_audit_function TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.manager_otp_challenges'::regclass
          AND tgname = 'audit_manager_otp_challenge_lifecycle'
          AND NOT tgisinternal
          AND tgenabled <> 'D'
    ) THEN
        RAISE WARNING 'SECURITY TEST FAILED: OTP challenge lifecycle audit trigger is missing';
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef('public.audit_manager_otp_challenge_lifecycle()'::regprocedure)
    INTO v_audit_function;

    IF v_audit_function ILIKE '%code_hash%'
       AND v_audit_function NOT ILIKE '%excludes code_hash%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: OTP challenge audit must not copy code_hash verifier material';
        RETURN FALSE;
    END IF;

    IF v_audit_function NOT ILIKE '%session_id_hash%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: OTP challenge audit must hash session identifiers';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_otp_challenge_lifecycle_audit() TO authenticated;
