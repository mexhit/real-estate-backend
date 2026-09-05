# Area deletion reassigns Properties instead of blocking or cascading

Deleting an Area whose Property Listings still resolve to it needed a rule: block the deletion, cascade-delete the properties, or reassign them elsewhere. We chose to require the caller to pick a replacement Area and reassign every affected Property Listing to it, atomically, as part of the same delete — so a Property Listing is never left pointing at a deleted Area and no listing data is lost. If no other Area exists to reassign to, deletion is impossible (there's nothing to pick), which doubles as the safeguard against deleting the last Area in the system, with no separate check needed.

## Considered Options

- **Block deletion outright** when properties are attached — simpler, but forces manually re-resolving every listing elsewhere before an Area can be retired.
- **Cascade-delete the properties** — unacceptable data loss.
- **Reassign to a mandatory target Area (chosen)** — no data loss, no orphaned reference, and the "last Area" edge case falls out for free.
