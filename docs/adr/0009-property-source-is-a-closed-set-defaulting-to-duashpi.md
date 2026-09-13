# Property Source is a closed set, defaults to duashpi, and stays read-only

Properties now carry a `source` identifying which website a Capture was scraped from (`duashpi`, `gazetacelesi`, and future sites). We chose a closed, code-defined set — mirroring `PropertyType` — over a free-form string, validated and normalized when a Capture is created. An unrecognized value silently falls back to `duashpi` rather than rejecting the write, consistent with how an invalid `propertyType` is already handled, so a scraper sending a bad value doesn't lose the listing entirely. All pre-existing rows are backfilled to `duashpi`, since that was the only site scraped before this field existed. Source is set once at creation and deliberately excluded from `MANUALLY_EDITABLE_FIELDS` — it records provenance, not listing content, so there's no user-facing edit path or edit-history tracking for it.

## Considered Options

- **Free-form string** — simpler, but gives no protection against a scraper typo silently creating an unintended new "source" with no code ever noticing.
- **Reject unrecognized values outright** — forces scrapers to stay in sync with the known set, but would break an external scraper's writes over what is currently a soft data-quality concern.
- **Closed set with silent fallback to `duashpi` (chosen)** — catches typos in code review when a new source is added deliberately, without making an unrecognized value fatal to ingestion.
