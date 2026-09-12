-- Adds support for manually editing a Property from the frontend:
-- tracks which fields a human has overridden (so the AI enrichment job
-- skips them) and a history log of every manual edit.
BEGIN;

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS "manuallyEditedFields" text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS property_edit_history (
  id SERIAL PRIMARY KEY,
  "propertyId" integer NOT NULL REFERENCES property (id) ON DELETE CASCADE,
  "userId" integer NOT NULL REFERENCES users (id),
  field varchar NOT NULL,
  "oldValue" text,
  "newValue" text,
  "editedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_property_edit_history_property_id"
  ON property_edit_history ("propertyId");

COMMIT;
