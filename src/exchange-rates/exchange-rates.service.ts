import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, Repository } from 'typeorm';
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
}
