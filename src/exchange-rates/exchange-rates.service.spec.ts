import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { ExchangeRatesService } from './exchange-rates.service';

const payload = () => ({
  source: 'https://iliria98.com/',
  fetchedAt: '2026-10-25T22:04:09.412Z',
  quoteCurrency: 'ALL',
  rates: { EUR: { buy: 90.2, sell: 91.1 }, USD: { buy: 80.4, sell: 81.4 } },
});

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;
  let repository: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((v) => v),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        ExchangeRatesService,
        { provide: getRepositoryToken(ExchangeRate), useValue: repository },
      ],
    }).compile();
    service = module.get(ExchangeRatesService);
  });

  describe('record', () => {
    it('stores one row per supported currency', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.record(payload());

      expect(result).toEqual({ stored: 2 });
      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'EUR', buy: 90.2, sell: 91.1 }),
      );
    });

    it('skips a duplicate currency/source/fetchedAt', async () => {
      repository.findOne.mockResolvedValue({ id: 1 });

      const result = await service.record(payload());

      expect(result).toEqual({ stored: 0 });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('ignores unknown currencies', async () => {
      repository.findOne.mockResolvedValue(null);
      const body = payload();
      (body.rates as Record<string, unknown>).GBP = { buy: 1, sell: 2 };

      await expect(service.record(body)).resolves.toEqual({ stored: 2 });
    });

    it.each([
      ['quoteCurrency', { quoteCurrency: 'EUR' }],
      ['fetchedAt', { fetchedAt: 'nope' }],
      ['source', { source: '' }],
      ['rate value', { rates: { EUR: { buy: -1, sell: 2 } } }],
    ])('rejects an invalid %s', async (_name, override) => {
      await expect(
        service.record({ ...payload(), ...override }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getLatest', () => {
    const at = (iso: string) => new Date(iso);

    it('returns empty rates when nothing is stored', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.getLatest();

      expect(result.rates).toEqual({});
      expect(result.fetchedAt).toBeNull();
    });

    it('reports trends against the last differing value', async () => {
      const latest = {
        currency: 'EUR',
        buy: 90.2,
        sell: 91.1,
        source: 'iliria98',
        fetchedAt: at('2026-10-25T22:00:00Z'),
      };
      repository.findOne.mockImplementation(({ where }) => {
        if (where.currency === 'USD') return null;
        if (where.buy) return { buy: 90.0 };
        if (where.sell) return { sell: 91.5 };
        return latest;
      });

      const result = await service.getLatest();

      expect(result.rates.EUR).toEqual({
        buy: 90.2,
        sell: 91.1,
        buyTrend: 'up',
        sellTrend: 'down',
        previousBuy: 90.0,
        previousSell: 91.5,
      });
      expect(result.rates.USD).toBeUndefined();
      expect(result.source).toBe('iliria98');
      expect(result.fetchedAt).toEqual(latest.fetchedAt);
    });

    it('reports none when a value has never moved', async () => {
      repository.findOne.mockImplementation(({ where }) =>
        where.buy || where.sell
          ? null
          : {
              currency: where.currency,
              buy: 1,
              sell: 2,
              source: 's',
              fetchedAt: at('2026-10-25T22:00:00Z'),
            },
      );

      const result = await service.getLatest();

      expect(result.rates.EUR).toMatchObject({
        buyTrend: 'none',
        sellTrend: 'none',
        previousBuy: null,
      });
    });
  });

  describe('getHistory', () => {
    // 2026-10-26 is after the DST change: Tirane is UTC+1 (midnight = 23:00Z).
    const now = new Date('2026-10-26T10:00:00Z');
    const row = (fetchedAt: string, buy: number) => ({
      fetchedAt: new Date(fetchedAt),
      buy,
      sell: buy + 1,
      source: 'iliria98',
    });

    it('rejects an unknown range or currency', async () => {
      await expect(
        service.getHistory('EUR', 'month' as never, now),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.getHistory('GBP' as never, 'today', now),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('is empty when the currency has no observations', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.getHistory('EUR', 'today', now);

      expect(result.points).toEqual([]);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('queries today from local midnight to now for the latest source', async () => {
      repository.findOne.mockResolvedValue(row('2026-10-26T09:00:00Z', 90));
      repository.find.mockResolvedValue([row('2026-10-26T09:00:00Z', 90)]);

      const result = await service.getHistory('EUR', 'today', now);

      const where = repository.find.mock.calls[0][0].where;
      expect(where.source).toBe('iliria98');
      expect(where.fetchedAt.value[0]).toEqual(
        new Date('2026-10-25T23:00:00Z'),
      );
      expect(where.fetchedAt.value[1]).toEqual(now);
      expect(result.points).toEqual([
        { at: new Date('2026-10-26T09:00:00Z'), buy: 90, sell: 91 },
      ]);
    });

    it('queries yesterday between the two local midnights', async () => {
      repository.findOne.mockResolvedValue(row('2026-10-26T09:00:00Z', 90));
      repository.find.mockResolvedValue([]);

      await service.getHistory('EUR', 'yesterday', now);

      const range = repository.find.mock.calls[0][0].where.fetchedAt.value;
      expect(range[0]).toEqual(new Date('2026-10-24T22:00:00Z'));
      expect(range[1]).toEqual(new Date('2026-10-25T23:00:00Z'));
    });

    it('keeps only the last observation of each local day for the week', async () => {
      repository.findOne.mockResolvedValue(row('2026-10-26T09:00:00Z', 92));
      repository.find.mockResolvedValue([
        row('2026-10-24T08:00:00Z', 90),
        row('2026-10-24T20:00:00Z', 91),
        row('2026-10-26T09:00:00Z', 92),
      ]);

      const result = await service.getHistory('EUR', 'week', now);

      expect(result.points.map((p) => p.buy)).toEqual([91, 92]);
    });
  });

  describe('getConversionRates', () => {
    type Row = {
      currency: string;
      source: string;
      fetchedAt: Date;
      buy: number;
    };
    const row = (
      currency: string,
      source: string,
      iso: string,
      buy: number,
    ): Row => ({ currency, source, fetchedAt: new Date(iso), buy });

    // Minimal in-memory stand-in for the repository's findOne and find.
    const useRows = (rows: Row[]) => {
      repository.find.mockImplementation(({ where }: { where: any }) =>
        Promise.resolve(
          rows
            .filter(
              (r) =>
                r.source === where.source &&
                where.currency.value.includes(r.currency),
            )
            .sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime()),
        ),
      );
      repository.findOne.mockImplementation(
        ({ where, order }: { where: any; order: any }) => {
          const matching = rows.filter((r) => {
            if (where.currency !== r.currency) return false;
            if (where.source && where.source !== r.source) return false;
            const at = where.fetchedAt;
            if (at?.type === 'lessThanOrEqual' && !(r.fetchedAt <= at.value))
              return false;
            if (at?.type === 'moreThanOrEqual' && !(r.fetchedAt >= at.value))
              return false;
            return true;
          });
          matching.sort(
            (a, b) =>
              (a.fetchedAt.getTime() - b.fetchedAt.getTime()) *
              (order.fetchedAt === 'DESC' ? -1 : 1),
          );
          return Promise.resolve(matching[0] ?? null);
        },
      );
    };

    it('returns the Sell Rate closest to the moment', async () => {
      useRows([
        row('EUR', 'A', '2026-10-01T10:00:00Z', 100),
        row('EUR', 'A', '2026-10-01T12:00:00Z', 102),
        row('USD', 'A', '2026-10-01T10:00:00Z', 90),
        row('USD', 'A', '2026-10-01T12:00:00Z', 92),
      ]);

      expect(
        await service.getConversionRates(new Date('2026-10-01T10:50:00Z')),
      ).toEqual({ EUR: 100, USD: 90 });
      expect(
        await service.getConversionRates(new Date('2026-10-01T11:30:00Z')),
      ).toEqual({ EUR: 102, USD: 92 });
    });

    it('uses the earliest rate for a moment before any was recorded', async () => {
      useRows([
        row('EUR', 'A', '2026-10-01T10:00:00Z', 100),
        row('EUR', 'A', '2026-10-02T10:00:00Z', 105),
      ]);

      expect(
        await service.getConversionRates(new Date('2026-01-01T00:00:00Z')),
      ).toEqual({ EUR: 100 });
    });

    it('uses the latest rate for a moment after the last one', async () => {
      useRows([
        row('EUR', 'A', '2026-10-01T10:00:00Z', 100),
        row('EUR', 'A', '2026-10-02T10:00:00Z', 105),
      ]);

      expect(
        await service.getConversionRates(new Date('2026-12-01T00:00:00Z')),
      ).toEqual({ EUR: 105 });
    });

    it('only uses the Rate Source of the latest euro rate', async () => {
      useRows([
        row('EUR', 'A', '2026-10-01T10:00:00Z', 100),
        row('EUR', 'B', '2026-10-03T10:00:00Z', 110),
      ]);

      expect(
        await service.getConversionRates(new Date('2026-10-01T10:00:00Z')),
      ).toEqual({ EUR: 110 });
    });

    it('is empty when no rate has ever been recorded', async () => {
      useRows([]);

      expect(await service.getConversionRates(new Date())).toEqual({});
    });

    it('lookup: returns the Sell Rate closest to the moment', async () => {
      useRows([
        row('EUR', 'A', '2026-10-01T10:00:00Z', 100),
        row('EUR', 'A', '2026-10-01T12:00:00Z', 102),
        row('USD', 'A', '2026-10-01T10:00:00Z', 90),
        row('USD', 'A', '2026-10-01T12:00:00Z', 92),
      ]);

      expect(
        (await service.getConversionRateLookup())(
          new Date('2026-10-01T10:50:00Z'),
        ),
      ).toEqual({ EUR: 100, USD: 90 });
      expect(
        (await service.getConversionRateLookup())(
          new Date('2026-10-01T11:30:00Z'),
        ),
      ).toEqual({ EUR: 102, USD: 92 });
    });

    it('lookup: uses the earliest rate for a moment before any was recorded', async () => {
      useRows([
        row('EUR', 'A', '2026-10-01T10:00:00Z', 100),
        row('EUR', 'A', '2026-10-02T10:00:00Z', 105),
      ]);

      expect(
        (await service.getConversionRateLookup())(
          new Date('2026-01-01T00:00:00Z'),
        ),
      ).toEqual({ EUR: 100 });
    });

    it('lookup: uses the latest rate for a moment after the last one', async () => {
      useRows([
        row('EUR', 'A', '2026-10-01T10:00:00Z', 100),
        row('EUR', 'A', '2026-10-02T10:00:00Z', 105),
      ]);

      expect(
        (await service.getConversionRateLookup())(
          new Date('2026-12-01T00:00:00Z'),
        ),
      ).toEqual({ EUR: 105 });
    });

    it('lookup: only uses the Rate Source of the latest euro rate', async () => {
      useRows([
        row('EUR', 'A', '2026-10-01T10:00:00Z', 100),
        row('EUR', 'B', '2026-10-03T10:00:00Z', 110),
      ]);

      expect(
        (await service.getConversionRateLookup())(
          new Date('2026-10-01T10:00:00Z'),
        ),
      ).toEqual({ EUR: 110 });
    });

    it('lookup: is empty when no rate has ever been recorded', async () => {
      useRows([]);

      expect((await service.getConversionRateLookup())(new Date())).toEqual({});
    });

    it('lookup: reads the rates table once, however many moments are asked', async () => {
      useRows([row('EUR', 'A', '2026-10-01T10:00:00Z', 100)]);

      const lookup = await service.getConversionRateLookup();
      lookup(new Date('2026-01-01T00:00:00Z'));
      lookup(new Date('2026-12-01T00:00:00Z'));

      expect(repository.find).toHaveBeenCalledTimes(1);
    });
  });
});
