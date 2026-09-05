# Real Estate Listings

This context describes property listings collected from external real-estate providers and reported through analytics.

## Language

**Property Listing**:
A distinct listing identified by its provider-specific `providerId`, regardless of how many times it is captured.
_Avoid_: Property record, posting

**New Property**:
A Property Listing counted on the calendar date when it was first observed, determined by its earliest `createdAt` value.
_Avoid_: Latest property, property record created that day

**Area**:
A named zone a Property Listing can be AI-resolved into (e.g. "Blloku", "Tirana e Re"), uniquely identified by a normalized `key`. Areas can be soft-deleted; a soft-deleted Area's `key` becomes available for reuse. A Property Listing keeps showing the name of its resolved Area even after that Area is soft-deleted, but only non-deleted Areas can be chosen to filter listings.
_Avoid_: Neighborhood, Zone

**AI Provider**:
A configured account (API key, model, retry settings) used to perform AI-resolution — metadata extraction and Area resolution are the same underlying call. Multiple AI Providers can call the same underlying vendor API (e.g. `GEMINI` and `GEMINI_2` both call Gemini, with different API keys) — "AI Provider" identifies the configured account, not the vendor. Configurable system-wide; switching it takes effect immediately for new work. Distinct from the real-estate listing provider a Property Listing's `providerId` identifies.
_Avoid_: Provider (ambiguous with the real-estate listing provider — always say "AI Provider")
