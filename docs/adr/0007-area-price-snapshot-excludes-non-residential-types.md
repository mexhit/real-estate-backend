# Area Price Snapshot averages only Residential Property Types

Shops, offices, land, and parking spots are priced per m² on a fundamentally different basis than apartments and houses — commonly at multiples of residential price/m² — so including them in an Area's average was pulling that average up and misrepresenting the residential market. The Area Price Snapshot's average now only considers Property Listings of a Residential Property Type (apartments, studio, private house, villa); `SHOP`, `OFFICE`, `LAND`, and `PARKING` listings are excluded from both the average and its sample count, not down-weighted or tracked separately. A listing with no Property Type recorded is still treated as Residential, since there's no evidence untyped listings skew non-residential and excluding them would just shrink the sample for no benefit.

Price Position was deliberately left unchanged: a non-Residential listing (e.g. a Shop) still gets classified against its Area's now-Residential-only average, rather than being excluded from Price Position or compared against a separate non-residential average. This was chosen for simplicity over building a second average, accepting that non-Residential listings will now skew heavily toward "Above Area Average."

## Consequences

A future reader should not "fix" a Shop or Office listing showing "Above Area Average" almost by default — that's the expected result of comparing a non-residential price against a residential-only baseline, not a bug. If a genuinely useful non-residential comparison is ever needed, it requires a separate average (e.g. a second Snapshot scoped to non-Residential types), not a change to Price Position's existing band logic.
