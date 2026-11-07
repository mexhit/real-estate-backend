import { backfillPriceEur, BackfillStore } from './price-eur-backfill';

type Row = {
  id: number;
  createdAt: Date;
  priceAmount: number | null;
  priceCurrency: string | null;
  priceEur: number | null;
};

const row = (id: number, overrides: Partial<Row> = {}): Row => ({
  id,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  priceAmount: 9_500_000,
  priceCurrency: 'ALL',
  priceEur: null,
  ...overrides,
});

const makeStore = (rows: Row[]) => {
  const writes: Array<[number, number | null]> = [];
  const batches: number[] = [];
  const store: BackfillStore = {
    findBatch: async (afterId, size) =>
      rows
        .filter((r) => r.id > afterId)
        .sort((a, b) => a.id - b.id)
        .slice(0, size),
    applyChanges: async (changes) => {
      batches.push(changes.length);
      for (const { id, priceEur } of changes) {
        writes.push([id, priceEur]);
        rows.find((r) => r.id === id)!.priceEur = priceEur;
      }
    },
  };
  return { store, writes, rows, batches };
};

const rates = async () => ({ EUR: 100, USD: 95 });

describe('backfillPriceEur', () => {
  it('fills empty values and corrects stale ones, leaving correct ones alone', async () => {
    const { store, writes, rows } = makeStore([
      row(1), // empty -> 95000
      row(2, { priceEur: 1 }), // stale -> 95000
      row(3, { priceAmount: 95000, priceCurrency: 'EUR', priceEur: 95000 }), // correct
    ]);

    const result = await backfillPriceEur({ store, getRates: rates });

    expect(rows.map((r) => r.priceEur)).toEqual([95000, 95000, 95000]);
    expect(writes).toEqual([
      [1, 95000],
      [2, 95000],
    ]);
    expect(result).toMatchObject({ scanned: 3, changed: 2 });
  });

  it('is idempotent: a second run changes nothing', async () => {
    const { store } = makeStore([
      row(1),
      row(2, { priceCurrency: 'USD', priceAmount: 100_000 }),
    ]);

    await backfillPriceEur({ store, getRates: rates });
    const second = await backfillPriceEur({ store, getRates: rates });

    expect(second).toMatchObject({ scanned: 2, changed: 0 });
  });

  it('clears a Euro Price that can no longer be derived', async () => {
    const { store, rows } = makeStore([
      row(1, { priceCurrency: 'GBP', priceEur: 5000 }),
    ]);

    await backfillPriceEur({ store, getRates: rates });

    expect(rows[0].priceEur).toBeNull();
  });

  it('counts captures that stay without a Euro Price', async () => {
    const { store } = makeStore([
      row(1),
      row(2, { priceCurrency: null }),
      row(3, { priceCurrency: 'GBP' }),
    ]);

    const result = await backfillPriceEur({ store, getRates: rates });

    expect(result).toMatchObject({ scanned: 3, changed: 1, empty: 2 });
  });

  it('uses the rate closest to each capture time', async () => {
    const createdAt = new Date('2026-03-01T10:00:00Z');
    const getRates = jest.fn().mockResolvedValue({ EUR: 100 });
    const { store } = makeStore([row(1, { createdAt })]);

    await backfillPriceEur({ store, getRates });

    expect(getRates).toHaveBeenCalledWith(createdAt);
  });

  it('writes nothing on a dry run but reports what would change', async () => {
    const { store, writes } = makeStore([row(1), row(2)]);

    const result = await backfillPriceEur({
      store,
      getRates: rates,
      dryRun: true,
    });

    expect(writes).toEqual([]);
    expect(result).toMatchObject({ scanned: 2, changed: 2 });
  });

  it('walks through every row in batches', async () => {
    const { store, rows } = makeStore([row(1), row(2), row(3), row(4), row(5)]);

    const result = await backfillPriceEur({
      store,
      getRates: rates,
      batchSize: 2,
    });

    expect(result.scanned).toBe(5);
    expect(rows.every((r) => r.priceEur === 95000)).toBe(true);
  });

  it('writes each batch of changes in one call, not row by row', async () => {
    const { store, batches } = makeStore([
      row(1),
      row(2),
      row(3),
      row(4),
      row(5),
    ]);

    await backfillPriceEur({ store, getRates: rates, batchSize: 3 });

    expect(batches).toEqual([3, 2]);
  });

  it('does not call the store when a batch has nothing to change', async () => {
    const { store, batches } = makeStore([
      row(1, { priceAmount: 95000, priceCurrency: 'EUR', priceEur: 95000 }),
    ]);

    await backfillPriceEur({ store, getRates: rates });

    expect(batches).toEqual([]);
  });
});
