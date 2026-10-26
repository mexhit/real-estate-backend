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
});
