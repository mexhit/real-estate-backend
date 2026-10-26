import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AllowApiKey } from '../auth/api-key.decorator';
import { ExchangeRateCurrency } from './exchange-rate.entity';
import {
  ExchangeRateHistoryRange,
  ExchangeRatesPayload,
  ExchangeRatesService,
} from './exchange-rates.service';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Post()
  @AllowApiKey()
  recordExchangeRates(@Body() payload: ExchangeRatesPayload) {
    return this.exchangeRatesService.record(payload);
  }

  @Get('latest')
  getLatestExchangeRates() {
    return this.exchangeRatesService.getLatest();
  }

  @Get('history')
  getExchangeRateHistory(
    @Query('currency') currency: ExchangeRateCurrency,
    @Query('range') range: ExchangeRateHistoryRange,
  ) {
    return this.exchangeRatesService.getHistory(currency, range);
  }
}
