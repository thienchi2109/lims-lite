-- Migration 071: Add full-text search to clients
-- Description: Adds tsvector column, GIN index, and automatic trigger for Vietnamese diacritic-insensitive search

SET search_path TO public;

-- Add tsvector column
ALTER TABLE clients
ADD COLUMN search_vector tsvector;

-- Create GIN index
-- Development: Use regular CREATE INDEX
-- Production: Use CREATE INDEX CONCURRENTLY to avoid table locks
CREATE INDEX clients_search_idx
ON clients USING GIN(search_vector);

-- Create trigger function (reusable for all tables)
-- This function combines searchable columns and applies unaccent for Vietnamese support
CREATE OR REPLACE FUNCTION update_search_vector_clients()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Combine searchable columns and apply unaccent
    NEW.search_vector := to_tsvector(
        'simple',
        unaccent(
            COALESCE(NEW.name, '') || ' ' ||
            COALESCE(NEW.phone, '') || ' ' ||
            COALESCE(NEW.address, '') || ' ' ||
            COALESCE(NEW.id_card_num, '') || ' ' ||
            COALESCE(NEW.health_insurance_num, '')
        )
    );
    RETURN NEW;
END;
$$;

-- Create trigger
-- NOTE: Only trigger on relevant column changes to reduce overhead
CREATE TRIGGER clients_search_update
BEFORE INSERT OR UPDATE OF name, phone, address, id_card_num, health_insurance_num ON clients
FOR EACH ROW EXECUTE FUNCTION update_search_vector_clients();

-- Backfill existing data
UPDATE clients SET search_vector = to_tsvector(
    'simple',
    unaccent(
        COALESCE(name, '') || ' ' ||
        COALESCE(phone, '') || ' ' ||
        COALESCE(address, '') || ' ' ||
        COALESCE(id_card_num, '') || ' ' ||
        COALESCE(health_insurance_num, '')
    )
);

-- Verify backfill (client count)
SELECT COUNT(*) as backfilled_clients FROM clients WHERE search_vector IS NOT NULL;
