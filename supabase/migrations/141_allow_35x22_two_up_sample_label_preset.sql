-- Allow the audited sample label print RPC to record the 35x22mm two-up thermal label preset.
--
-- Security Impact:
-- - Replaces the existing SECURITY DEFINER RPC without widening roles or table access.
-- - Keeps the fixed search_path, authenticated analyst/manager check, and confidential sample fail-closed behavior.
-- - Adds only a new non-sensitive label_preset value to audit metadata.

CREATE OR REPLACE FUNCTION public.record_sample_label_print(
    p_sample_id UUID,
    p_copies INTEGER DEFAULT 1,
    p_label_preset TEXT DEFAULT 'thermal-35x22-2up'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role public.user_role := public.get_user_role();
    v_sample RECORD;
    v_copies INTEGER := COALESCE(p_copies, 1);
    v_preset TEXT := COALESCE(NULLIF(BTRIM(p_label_preset), ''), 'thermal-35x22-2up');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF v_user_role NOT IN ('analyst', 'manager') THEN
        RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
    END IF;

    IF v_copies < 1 OR v_copies > 20 THEN
        RAISE EXCEPTION 'Invalid label copy count' USING ERRCODE = '22023';
    END IF;

    IF v_preset NOT IN ('thermal-35x22-2up', 'small-tube', 'container') THEN
        RAISE EXCEPTION 'Invalid label preset' USING ERRCODE = '22023';
    END IF;

    SELECT s.id, s.sample_id
    INTO v_sample
    FROM public.samples s
    WHERE s.id = p_sample_id
      AND s.deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found' USING ERRCODE = 'P0002';
    END IF;

    IF public.sample_has_confidential_results(v_sample.id)
       AND NOT public.user_can_access_confidential() THEN
        RAISE EXCEPTION 'Sample not found' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        operation,
        new_values,
        changed_by
    ) VALUES (
        'samples',
        v_sample.id,
        'LABEL_PRINT_REQUESTED',
        jsonb_build_object(
            'sample_id', v_sample.sample_id,
            'copies', v_copies,
            'label_preset', v_preset,
            'label_version', 1
        ),
        v_user_id
    );

    RETURN jsonb_build_object(
        'sample_id', v_sample.id,
        'sample_display_id', v_sample.sample_id,
        'copies', v_copies,
        'label_preset', v_preset
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_sample_label_print(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sample_label_print(UUID, INTEGER, TEXT) TO authenticated;
