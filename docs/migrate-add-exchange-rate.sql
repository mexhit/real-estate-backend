-- Adds the exchange_rate table: one append-only row per currency per
-- scraper post, so the latest rate can be compared with the previous move.
BEGIN;

CREATE TABLE IF NOT EXISTS exchange_rate (
  id SERIAL PRIMARY KEY,
  currency varchar NOT NULL,
  "quoteCurrency" varchar NOT NULL,
  buy numeric NOT NULL,
  sell numeric NOT NULL,
  source varchar NOT NULL,
  "fetchedAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_exchange_rate_currency_source_fetched_at"
  ON exchange_rate (currency, source, "fetchedAt");

COMMIT;
