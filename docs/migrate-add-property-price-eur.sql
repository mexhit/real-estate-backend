-- Adds the Euro Price to each Capture: a whole-euro amount derived from
-- priceAmount + priceCurrency (see docs/adr/0013). Existing rows stay empty
-- until the backfill runs: npm run backfill:price-eur
BEGIN;

ALTER TABLE property
  ADD COLUMN IF NOT EXISTS "priceEur" integer NULL;

CREATE INDEX IF NOT EXISTS "IDX_property_price_eur"
  ON property ("priceEur");

COMMIT;
