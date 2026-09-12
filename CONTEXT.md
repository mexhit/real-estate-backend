# Real Estate Listings

This context describes property listings collected from external real-estate providers and reported through analytics.

## Language

**Property Listing**:
A distinct listing identified by its provider-specific `providerId`, regardless of how many times it is captured.
_Avoid_: Property record, posting

**Capture**:
A single stored observation of a Property Listing (one row in the `property` table), made when the listing is first or re-observed. A Property Listing may have multiple Captures over time.
_Avoid_: Property record, duplicate

**New Property**:
A Property Listing counted on the calendar date when it was first observed, determined by its earliest `createdAt` value.
_Avoid_: Latest property, property record created that day

**Property Type**:
A Property Listing's classification of what kind of space it is (e.g. `APARTMENT_1_1`, `STUDIO`, `VILLA`, `SHOP`, `OFFICE`, `LAND`, `PARKING`). A Property Listing may have no Property Type recorded.
_Avoid_: Category, listing type

**Residential Property Type**:
The subset of Property Types (apartments, studio, private house, villa) whose price-per-m² is comparable enough to feed an Area Price Snapshot's average. `SHOP`, `OFFICE`, `LAND`, and `PARKING` are not Residential Property Types — their per-m² pricing doesn't compare meaningfully to residential pricing, so Property Listings of those types are excluded from the average entirely. A Property Listing with no Property Type recorded is treated as Residential for this purpose.
_Avoid_: Commercial property type (only the negative is named; there's no "Commercial" grouping, just "not Residential")

**Area**:
A named zone a Property Listing can be AI-resolved into (e.g. "Blloku", "Tirana e Re"), uniquely identified by a normalized `key`. Areas can be soft-deleted; a soft-deleted Area's `key` becomes available for reuse. Deleting an Area requires reassigning every Property Listing currently resolved to it to another Area, atomically, as part of the same operation — an Area can never be deleted out from under a Property Listing. Only non-deleted Areas can be chosen to filter listings or as a reassignment target. An Area also carries its most recent Area Price Snapshot's value directly, for fast display.
_Avoid_: Neighborhood, Zone

**Area Price Snapshot**:
A record of the average price-per-m² computed for an Area during one run of the pricing job, together with how many Property Listings (via their latest Capture in the Snapshot Window) fed the calculation. Only Property Listings of a Residential Property Type feed the average — a listing of any other Property Type is left out of both the average and the count entirely. The pricing job runs weekly on schedule, but can also be triggered manually (e.g. for testing); a manually-triggered run is a real run — it produces a real Snapshot and updates the Area's displayed price exactly like a scheduled run, with no distinction recorded between the two. Each run produces one Snapshot per Area, forming a running history. A Snapshot never records which specific Property Listings fed it — only the aggregate; its Contributing Listings are reconstructed on demand, not stored.
_Avoid_: Area stats, price history entry, weekly pricing job (it isn't only weekly anymore)

**Snapshot Window**:
The 30-day period ending at an Area Price Snapshot run's time. A Capture must fall within this window for its Property Listing to be considered for that Snapshot.
_Avoid_: Lookback period, pricing window

**Dominant Currency**:
The currency shared by the largest number of eligible Property Listings feeding one Area Price Snapshot. Listings priced in a different currency, or with no currency, are excluded from that Snapshot.
_Avoid_: Primary currency, base currency

**Contributing Listing**:
A Property Listing whose latest Capture within an Area Price Snapshot's Window was included in that Snapshot's average — it is a Residential Property Type (or untyped), and that Capture's price and area are positive and priced in the Snapshot's Dominant Currency. Because Snapshots don't persist membership, a Snapshot's Contributing Listings are reconstructed by re-querying current Property data against that run's Window and Dominant Currency; this reconstruction can drift from the Snapshot's cached count if a listing's type, Area, or price is edited after the run (accepted as a rare, self-correcting inconsistency — see `docs/adr/0008-snapshot-membership-reconstructed-not-persisted.md`).
_Avoid_: Eligible property, snapshot member, included listing

**Price Position**:
A Property Listing's price-per-m² classified against its Area's cached Area Price Snapshot average, as `Above Area Average`, `Below Area Average`, or `In Line With Area Average` (within a ±5% band). Computed only when the Property Listing's `priceCurrency` matches the Area's `avgPriceCurrency` and the Area's snapshot was built from at least 5 Property Listings; otherwise there is no Price Position. Computed for every Property Listing regardless of Property Type — a non-Residential listing (e.g. a Shop) is still classified against the Area's Residential-only average, deliberately, rather than being excluded from Price Position too. Computed server-side so the band and minimum-sample rules stay in one place.
_Avoid_: Price indicator, relative price, over/underpriced

**AI Provider**:
A configured account (API key, model, retry settings) used to perform AI-resolution — metadata extraction and Area resolution are the same underlying call. Multiple AI Providers can call the same underlying vendor API (e.g. `GEMINI` and `GEMINI_2` both call Gemini, with different API keys) — "AI Provider" identifies the configured account, not the vendor. Configurable system-wide; switching it takes effect immediately for new work. Distinct from the real-estate listing provider a Property Listing's `providerId` identifies.
_Avoid_: Provider (ambiguous with the real-estate listing provider — always say "AI Provider")
