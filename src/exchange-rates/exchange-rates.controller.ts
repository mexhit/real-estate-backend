import { Body, Controller, Get, Post } from '@nestjs/common';
import { AllowApiKey } from '../auth/api-key.decorator';
import {
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
}
