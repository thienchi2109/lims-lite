-- Migration 068: Install unaccent extension for Vietnamese search
-- Description: Enables diacritic-insensitive search for Vietnamese text

SET search_path TO public;

-- Install unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Test with Vietnamese text
-- This should transform "Huyết thanh" to "Huyet thanh"
SELECT unaccent('Huyết thanh') AS test_result;
