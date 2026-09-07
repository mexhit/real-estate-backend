# Area Price Snapshot recomputes Dominant Currency per run

Property Listings feeding an Area's weekly price calculation can carry different currencies (`priceCurrency` is free-text, AI-inferred per listing, not fixed per Area). Each Area Price Snapshot computes its own Dominant Currency as the currency shared by the most eligible listings that run — listings in any other currency are excluded from the average — rather than fixing one currency per Area up front. This keeps each Snapshot accurate to what that week's data actually contains, at the cost that an Area's displayed currency can change between runs if the mix of listing currencies shifts.

## Consequences

A future reader seeing an Area's displayed currency change week to week should not treat this as a bug — it reflects an actual shift in which currency dominates that Area's recent listings. No currency conversion happens; listings in the non-dominant currency are simply excluded from that run's average, not converted.
