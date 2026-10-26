import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Not, Repository } from 'typeorm';
import {
  EXCHANGE_RATE_CURRENCIES,
  EXCHANGE_RATE_QUOTE_CURRENCY,
  ExchangeRate,
  ExchangeRateCurrency,
} from './exchange-rate.entity';

export interface ExchangeRatesPayload {
  source: string;
  fetchedAt: string;
  quoteCurrency: string;
  rates: Record<string, { buy: number; sell: number }>;
}

export type RateTrend = 'up' | 'down' | 'unchanged' | 'none';

export interface LatestExchangeRate {
  buy: number;
  sell: number;
  buyTrend: RateTrend;
  sellTrend: RateTrend;
  previousBuy: number | null;
  previousSell: number | null;
}

export interface LatestExchangeRates {
  source: string | null;
  fetchedAt: Date | null;
  quoteCurrency: string;
  rates: Partial<Record<ExchangeRateCurrency, LatestExchangeRate>>;
}

export const EXCHANGE_RATE_HISTORY_RANGES = [
  'today',
  'yesterday',
  'week',
] as const;
export type ExchangeRateHistoryRange =
  (typeof EXCHANGE_RATE_HISTORY_RANGES)[number];

export interface ExchangeRateHistoryPoint {
  at: Date;
  buy: number;
  sell: number;
}

export interface ExchangeRateHistory {
  currency: ExchangeRateCurrency;
  range: ExchangeRateHistoryRange;
  source: string | null;
  points: ExchangeRateHistoryPoint[];
}

const RATE_TIME_ZONE = 'Europe/Tirane';

const tiraneDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: RATE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const tiraneParts = new Intl.DateTimeFormat('en-US', {
  timeZone: RATE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

const tiraneOffsetMs = (instant: Date): number => {
  const parts = Object.fromEntries(
    tiraneParts.formatToParts(instant).map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

// Instant of local midnight, `daysAgo` Tirane calendar days before `now`.
const startOfTiraneDay = (now: Date, daysAgo: number): Date => {
  const [year, month, day] = tiraneDay.format(now).split('-').map(Number);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day - daysAgo);
  const guess = new Date(localMidnightAsUtc - tiraneOffsetMs(now));
  return new Date(localMidnightAsUtc - tiraneOffsetMs(guess));
};

const trendOf = (current: number, previous: number | null): RateTrend => {
  if (previous === null) return 'none';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'unchanged';
};

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

@Injectable()
export class ExchangeRatesService {
  constructor(
    @InjectRepository(ExchangeRate)
    private readonly repository: Repository<ExchangeRate>,
  ) {}

  async record(payload: ExchangeRatesPayload): Promise<{ stored: number }> {
    if (!payload?.source || typeof payload.source !== 'string') {
      throw new BadRequestException('source is required');
    }
    if (payload.quoteCurrency !== EXCHANGE_RATE_QUOTE_CURRENCY) {
      throw new BadRequestException(
        `quoteCurrency must be ${EXCHANGE_RATE_QUOTE_CURRENCY}`,
      );
    }
    const fetchedAt = new Date(payload.fetchedAt);
    if (!payload.fetchedAt || Number.isNaN(fetchedAt.getTime())) {
      throw new BadRequestException('fetchedAt must be a valid date');
    }
    if (!payload.rates || typeof payload.rates !== 'object') {
      throw new BadRequestException('rates is required');
    }

    // Unknown currency codes are ignored so new ones can be added later
    // without breaking the scraper.
    const rows: ExchangeRate[] = [];
    for (const currency of EXCHANGE_RATE_CURRENCIES) {
      const rate = payload.rates[currency];
      if (!rate) continue;
      if (!isPositiveNumber(rate.buy) || !isPositiveNumber(rate.sell)) {
        throw new BadRequestException(
          `${currency} buy and sell must be positive numbers`,
        );
      }
      rows.push(
        this.repository.create({
          currency,
          quoteCurrency: payload.quoteCurrency,
          buy: rate.buy,
          sell: rate.sell,
          source: payload.source,
          fetchedAt,
        }),
      );
    }

    let stored = 0;
    for (const row of rows) {
      const duplicate = await this.repository.findOne({
        where: {
          currency: row.currency,
          source: row.source,
          fetchedAt: row.fetchedAt,
        },
      });
      if (duplicate) continue;
      await this.repository.save(row);
      stored++;
    }

    return { stored };
  }

  async getLatest(): Promise<LatestExchangeRates> {
    const result: LatestExchangeRates = {
      source: null,
      fetchedAt: null,
      quoteCurrency: EXCHANGE_RATE_QUOTE_CURRENCY,
      rates: {},
    };

    for (const currency of EXCHANGE_RATE_CURRENCIES) {
      const latest = await this.repository.findOne({
        where: { currency },
        order: { fetchedAt: 'DESC', id: 'DESC' },
      });
      if (!latest) continue;

      // "Previous" is the last actual move, so a re-posted unchanged rate
      // doesn't reset the indicator to "unchanged".
      const [previousBuyRow, previousSellRow] = await Promise.all([
        this.repository.findOne({
          where: {
            currency,
            fetchedAt: LessThan(latest.fetchedAt),
            buy: Not(latest.buy),
          },
          order: { fetchedAt: 'DESC', id: 'DESC' },
        }),
        this.repository.findOne({
          where: {
            currency,
            fetchedAt: LessThan(latest.fetchedAt),
            sell: Not(latest.sell),
          },
          order: { fetchedAt: 'DESC', id: 'DESC' },
        }),
      ]);
      const previousBuy = previousBuyRow?.buy ?? null;
      const previousSell = previousSellRow?.sell ?? null;

      result.rates[currency] = {
        buy: latest.buy,
        sell: latest.sell,
        buyTrend: trendOf(latest.buy, previousBuy),
        sellTrend: trendOf(latest.sell, previousSell),
        previousBuy,
        previousSell,
      };

      if (!result.fetchedAt || latest.fetchedAt > result.fetchedAt) {
        result.fetchedAt = latest.fetchedAt;
        result.source = latest.source;
      }
    }

    return result;
  }

  async getHistory(
    currency: ExchangeRateCurrency,
    range: ExchangeRateHistoryRange,
    now: Date = new Date(),
  ): Promise<ExchangeRateHistory> {
    if (!EXCHANGE_RATE_CURRENCIES.includes(currency)) {
      throw new BadRequestException(
        `currency must be one of ${EXCHANGE_RATE_CURRENCIES.join(', ')}`,
      );
    }
    if (!EXCHANGE_RATE_HISTORY_RANGES.includes(range)) {
      throw new BadRequestException(
        `range must be one of ${EXCHANGE_RATE_HISTORY_RANGES.join(', ')}`,
      );
    }

    const empty: ExchangeRateHistory = {
      currency,
      range,
      source: null,
      points: [],
    };
    const latest = await this.repository.findOne({
      where: { currency },
      order: { fetchedAt: 'DESC', id: 'DESC' },
    });
    if (!latest) return empty;

    const from = startOfTiraneDay(
      now,
      range === 'yesterday' ? 1 : range === 'week' ? 6 : 0,
    );
    const to = range === 'yesterday' ? startOfTiraneDay(now, 0) : now;

    const rows = await this.repository.find({
      where: {
        currency,
        source: latest.source,
        fetchedAt: Between(from, to),
      },
      order: { fetchedAt: 'ASC', id: 'ASC' },
    });

    let selected = rows;
    if (range === 'week') {
      // One point per Tirane day: that day's last observation.
      const lastOfDay = new Map<string, ExchangeRate>();
      for (const row of rows)
        lastOfDay.set(tiraneDay.format(row.fetchedAt), row);
      selected = [...lastOfDay.values()];
    }

    return {
      ...empty,
      source: latest.source,
      points: selected.map(({ fetchedAt, buy, sell }) => ({
        at: fetchedAt,
        buy,
        sell,
      })),
    };
  }
}
