-- Adds the Area table (neighborhood/zone roster used by AI extraction and
-- administered independently). The unique index on "key" is scoped to
-- non-deleted rows so a soft-deleted Area's key can be reused later.
BEGIN;

CREATE TABLE IF NOT EXISTS area (
  id SERIAL PRIMARY KEY,
  name varchar NOT NULL,
  key varchar NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_area_key_unique"
  ON area (key)
  WHERE "deletedAt" IS NULL;

COMMIT;
