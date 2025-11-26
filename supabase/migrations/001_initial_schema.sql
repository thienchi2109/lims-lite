-- CDC-LIMS Database Schema
-- Migration 001: Initial Schema
-- Creates core tables for LIMS system with 21 CFR Part 11 compliance

-- Set search path to ensure we're in the right schema
SET search_path TO public;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('analyst', 'manager');
CREATE TYPE sample_status AS ENUM ('received', 'assigned', 'in_progress', 'review', 'completed');
CREATE TYPE result_status AS ENUM ('pending', 'entered', 'approved');

-- ============================================================================
-- USERS TABLE (Extended Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'analyst',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- METHODS TABLE (Laboratory Methods/Procedures)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    procedure_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- ASSAY DEFINITIONS TABLE (Test Definitions)
-- ============================================================================
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

-- ============================================================================
-- SAMPLES TABLE
-- ============================================================================
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

-- ============================================================================
-- RESULTS TABLE
-- ============================================================================
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

-- ============================================================================
-- AUDIT LOGS TABLE (21 CFR Part 11 Compliance)
-- ============================================================================
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

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================
CREATE INDEX idx_samples_sample_id ON public.samples(sample_id);
CREATE INDEX idx_samples_status ON public.samples(status);
CREATE INDEX idx_samples_deleted_at ON public.samples(deleted_at);
CREATE INDEX idx_results_sample_id ON public.results(sample_id);
CREATE INDEX idx_results_status ON public.results(status);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_methods_updated_at BEFORE UPDATE ON public.methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assay_definitions_updated_at BEFORE UPDATE ON public.assay_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_samples_updated_at BEFORE UPDATE ON public.samples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON public.results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS for Documentation
-- ============================================================================
COMMENT ON TABLE public.users IS 'Extended user profiles with role-based access control';
COMMENT ON TABLE public.methods IS 'Laboratory methods and procedures';
COMMENT ON TABLE public.assay_definitions IS 'Test definitions with validation rules';
COMMENT ON TABLE public.samples IS 'Sample records with workflow status';
COMMENT ON TABLE public.results IS 'Test results linked to samples and assays';
COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for 21 CFR Part 11 compliance';
