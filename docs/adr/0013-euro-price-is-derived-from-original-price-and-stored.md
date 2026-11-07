# Euro Price is derived from the Original Price and stored on the Capture

Property Listings are priced in different currencies (mostly EUR and ALL, some USD), and `priceCurrency` is free-text read per Capture. Every calculation needs one currency, so each Capture carries a `priceEur` column: the Original Price (`priceAmount` + `priceCurrency`, the source of truth) converted to whole euros at the Sell Rate of the Exchange Rate closest to the Capture's `createdAt`, using the Rate Source of the latest EUR rate. USD converts through lek. Any other or missing currency, or a missing rate, leaves it empty and the Capture is left out of calculations. This supersedes [ADR 0005](0005-area-price-snapshot-recomputes-dominant-currency.md): Dominant Currency and the currency-match rule in Price Position are retired.

The value is derived, never edited. Conversion runs explicitly where price is written (capture creation, manual edit, AI parse) and in a backfill script. It is stored because snapshots, Price Position, filters and sorting need to compute and index on it in SQL.

## Considered Options

- **Convert on read with the latest rate** — no stored column, but every Area average drifts when the lek moves with no listing changing, and SQL aggregation needs a join on rates.
- **Keep Dominant Currency and exclude other currencies (status quo)** — no conversion, but the minority-currency listings never count.
- **Stored, derived at the rate closest to capture time (chosen)** — stable history and cheap queries. Because Exchange Rates are append-only the value is reproducible, so a backfill can recompute it.

## Consequences

- Editing `priceEur` is not allowed; correct the Original Price and it is recomputed.
- Bulk SQL updates to `priceAmount`/`priceCurrency` bypass the explicit calls and must recompute `priceEur` themselves.
- Area Price Snapshots recorded before this change keep their original currency.
