-- Complete CDC-LIMS Database Setup
-- All-in-one script: extensions, migrations, and seed data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;

-- Create auth.uid() function (simplified for standalone setup)
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', '00000000-0000-0000-0000-000000000000')::UUID;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- MIGRATION 001: INITIAL SCHEMA
-- ============================================================================
SET search_path TO public;

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('analyst', 'manager');
CREATE TYPE sample_status AS ENUM ('received', 'assigned', 'in_progress', 'review', 'completed');
CREATE TYPE result_status AS ENUM ('pending', 'entered', 'approved');

-- Create a simple auth.users table for standalone setup
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE
);

-- USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'analyst',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- METHODS TABLE
CREATE TABLE IF NOT EXISTS public.methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    procedure_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ASSAY DEFINITIONS TABLE
CREATE TABLE IF NOT EXISTS public.assay_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    method_id UUID REFERENCES public.methods(id),
    units TEXT,
    validation_rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- SAMPLES TABLE
CREATE TABLE IF NOT EXISTS public.samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id TEXT UNIQUE NOT NULL,
    client_id UUID,
    client_name TEXT,
    status sample_status NOT NULL DEFAULT 'received',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
    assay_id UUID NOT NULL REFERENCES public.assay_definitions(id),
    method_id UUID REFERENCES public.methods(id),
    value TEXT,
    status result_status NOT NULL DEFAULT 'pending',
    entered_by UUID REFERENCES public.users(id),
    entered_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES public.users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_samples_sample_id ON public.samples(sample_id);
CREATE INDEX IF NOT EXISTS idx_samples_status ON public.samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_deleted_at ON public.samples(deleted_at);
CREATE INDEX IF NOT EXISTS idx_results_sample_id ON public.results(sample_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON public.results(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_methods_updated_at ON public.methods;
CREATE TRIGGER update_methods_updated_at BEFORE UPDATE ON public.methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assay_definitions_updated_at ON public.assay_definitions;
CREATE TRIGGER update_assay_definitions_updated_at BEFORE UPDATE ON public.assay_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_samples_updated_at ON public.samples;
CREATE TRIGGER update_samples_updated_at BEFORE UPDATE ON public.samples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_results_updated_at ON public.results;
CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON public.results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION 002: AUDIT TRIGGERS
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

-- Apply audit triggers
DROP TRIGGER IF EXISTS audit_samples_trigger ON public.samples;
CREATE TRIGGER audit_samples_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.samples
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

DROP TRIGGER IF EXISTS audit_results_trigger ON public.results;
CREATE TRIGGER audit_results_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.results
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

DROP TRIGGER IF EXISTS audit_users_trigger ON public.users;
CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Create auth users
INSERT INTO auth.users (id, email) VALUES
('a0000000-0000-0000-0000-000000000001', 'analyst@cdc-lims.local'),
('b0000000-0000-0000-0000-000000000001', 'manager@cdc-lims.local')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- Create public users
INSERT INTO public.users (id, username, full_name, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'analyst', 'Test Analyst', 'analyst'),
('b0000000-0000-0000-0000-000000000001', 'manager', 'Test Manager', 'manager')
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- Create methods
INSERT INTO public.methods (id, name, description, procedure_reference) VALUES
('00000000-0000-0000-0000-000000000001', 'EPA Method 150.1', 'Standard pH Measurement', 'EPA-150.1-1982'),
('00000000-0000-0000-0000-000000000002', 'EPA Method 300.0', 'Determination of Inorganic Anions by Ion Chromatography', 'EPA-300.0-1993')
ON CONFLICT (id) DO NOTHING;

-- Create assay definitions
INSERT INTO public.assay_definitions (id, name, method_id, units, validation_rules) VALUES
('10000000-0000-0000-0000-000000000001', 'pH', '00000000-0000-0000-0000-000000000001', 'S.U.', 
'{"type": "numeric", "min": 0, "max": 14, "required": true}'::jsonb),
('10000000-0000-0000-0000-000000000002', 'Temperature', '00000000-0000-0000-0000-000000000001', '°C', 
'{"type": "numeric", "min": -50, "max": 100, "required": true}'::jsonb),
('10000000-0000-0000-0000-000000000003', 'Turbidity', '00000000-0000-0000-0000-000000000001', 'NTU', 
'{"type": "numeric", "min": 0, "max": 1000, "required": true}'::jsonb),
('10000000-0000-0000-0000-000000000004', 'Free Chlorine', '00000000-0000-0000-0000-000000000002', 'mg/L', 
'{"type": "numeric", "min": 0, "max": 10, "required": true}'::jsonb),
('10000000-0000-0000-0000-000000000005', 'Conductivity', '00000000-0000-0000-0000-000000000001', 'µS/cm', 
'{"type": "numeric", "min": 0, "max": 50000, "required": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Create sample data
DO $$
DECLARE
    analyst_id UUID := 'a0000000-0000-0000-0000-000000000001';
    sample_id UUID;
    i INTEGER;
    created_samples INTEGER := 0;
BEGIN
    FOR i IN 1..20 LOOP
        INSERT INTO public.samples (sample_id, client_name, status, received_by, received_at)
        VALUES (
            'CDC-XN-' || TO_CHAR(CURRENT_DATE, 'DDMMYYYY') || '-' || LPAD(i::TEXT, 4, '0'),
            'Test Client ' || i,
            'received',
            analyst_id,
            CURRENT_TIMESTAMP - (i || ' hours')::INTERVAL
        )
        ON CONFLICT (sample_id) DO NOTHING
        RETURNING id INTO sample_id;
        
        IF sample_id IS NOT NULL THEN
            created_samples := created_samples + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Created % samples', created_samples;
END $$;

-- Assign tests to first 5 samples
DO $$
DECLARE
    sample_record RECORD;
    assay_record RECORD;
    result_count INTEGER := 0;
BEGIN
    FOR sample_record IN 
        SELECT id FROM public.samples 
        WHERE status = 'received'
        AND sample_id LIKE 'CDC-XN-%'
        ORDER BY created_at DESC
        LIMIT 5
    LOOP
        FOR assay_record IN 
            SELECT id FROM public.assay_definitions 
            WHERE deleted_at IS NULL
        LOOP
            INSERT INTO public.results (sample_id, assay_id, status)
            VALUES (sample_record.id, assay_record.id, 'pending')
            ON CONFLICT DO NOTHING;
            
            result_count := result_count + 1;
        END LOOP;

        UPDATE public.samples 
        SET status = 'assigned'
        WHERE id = sample_record.id;
    END LOOP;

    RAISE NOTICE 'Created % test assignments (results)', result_count;
END $$;

-- Verification
SELECT 'Users Created:' as info, COUNT(*) as count FROM auth.users WHERE email LIKE '%@cdc-lims.local';
SELECT 'Public Users:' as info, COUNT(*) as count FROM public.users;
SELECT 'Methods:' as info, COUNT(*) as count FROM public.methods;
SELECT 'Assays:' as info, COUNT(*) as count FROM public.assay_definitions;
SELECT 'Samples:' as info, COUNT(*) as count FROM public.samples WHERE sample_id LIKE 'CDC-XN-%';
SELECT 'Results (Pending):' as info, COUNT(*) as count FROM public.results WHERE status = 'pending';
