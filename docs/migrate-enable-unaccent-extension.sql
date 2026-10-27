-- Enables accent-insensitive property Search (e.g. "celesi" finds "Çelësi").
-- Idempotent: safe to run more than once.
CREATE EXTENSION IF NOT EXISTS unaccent;
