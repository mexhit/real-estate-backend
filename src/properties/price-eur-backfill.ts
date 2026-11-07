import {
  ConversionRates,
  convertToEur,
} from '../exchange-rates/convert-to-eur';
import { Property } from './property.entity';

type BackfillRow = Pick<
  Property,
  'id' | 'createdAt' | 'priceAmount' | 'priceCurrency' | 'priceEur'
>;

export interface BackfillStore {
  // Rows with id greater than `afterId`, ascending, at most `size` of them.
  findBatch(afterId: number, size: number): Promise<BackfillRow[]>;
  // Writes a whole batch of changes in one go.
  applyChanges(
    changes: { id: number; priceEur: number | null }[],
  ): Promise<void>;
}

export interface BackfillResult {
  scanned: number;
  changed: number;
  // Captures that end up without a Euro Price (unsupported or missing currency, or no rate).
  empty: number;
}

/**
 * Recomputes every Capture's Euro Price from its Original Price. The result
 * depends only on the Original Price and the recorded Exchange Rates, so it is
 * safe to re-run.
 */
export async function backfillPriceEur({
  store,
  getRates,
  batchSize = 500,
  dryRun = false,
}: {
  store: BackfillStore;
  getRates: (at: Date) => ConversionRates | Promise<ConversionRates>;
  batchSize?: number;
  dryRun?: boolean;
}): Promise<BackfillResult> {
  const result: BackfillResult = { scanned: 0, changed: 0, empty: 0 };
  let afterId = 0;

  for (;;) {
    const batch = await store.findBatch(afterId, batchSize);
    if (batch.length === 0) return result;

    const changes: { id: number; priceEur: number | null }[] = [];

    for (const row of batch) {
      const next = convertToEur(
        row.priceAmount,
        row.priceCurrency,
        await getRates(row.createdAt),
      );

      result.scanned++;
      if (next === null) result.empty++;
      if (next !== row.priceEur) {
        result.changed++;
        changes.push({ id: row.id, priceEur: next });
      }
    }

    if (changes.length > 0 && !dryRun) await store.applyChanges(changes);

    afterId = batch[batch.length - 1].id;
  }
}
