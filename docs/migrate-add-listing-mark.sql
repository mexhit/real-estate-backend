-- Moves Bookmarked off the Capture rows and adds Dismissed, both as marks on the Property Listing
-- (keyed by providerId) so they survive a re-post. One row per listing; absence of a row means no mark.
-- Every providerId with any bookmarked Capture is backfilled as Bookmarked before the old column is dropped.
BEGIN;

CREATE TABLE IF NOT EXISTS listing_mark (
  "providerId" varchar PRIMARY KEY,
  status varchar NOT NULL CHECK (status IN ('bookmarked', 'dismissed'))
);

INSERT INTO listing_mark ("providerId", status)
SELECT DISTINCT "providerId", 'bookmarked'
FROM property
WHERE bookmarked = true
ON CONFLICT ("providerId") DO NOTHING;

DROP INDEX IF EXISTS "IDX_property_bookmarked";

ALTER TABLE property
  DROP COLUMN IF EXISTS bookmarked;

COMMIT;
