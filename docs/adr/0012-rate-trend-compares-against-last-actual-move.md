# Rate Trend compares against the last actual move

The scraper may post the same Exchange Rate many times between real changes. Comparing the latest rate with the immediately preceding post would make the Rate Trend read "unchanged" almost always. Instead, buy and sell are each compared with the most recent earlier observation where that value differed, so the arrow means "direction of the last real move" and persists until the next move. Every post is stored (append-only), which is what makes this reconstructable.

## Considered Options

- **Compare with the immediately preceding post** — simpler, but the indicator is useless when the scraper polls faster than the rate moves.
- **Compare with the last distinct value (chosen)** — costs two lookups per currency, but the indicator stays meaningful.
