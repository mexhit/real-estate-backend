// One-off: recompute Euro Price for every existing Capture.
//   node -r dotenv/config dist/properties/backfill-price-eur.js [--dry-run]
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { backfillPriceEur, BackfillStore } from './price-eur-backfill';
import { Property } from './property.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + '/../**/*.entity.{js,ts}'],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Property]),
    ExchangeRatesModule,
  ],
})
class BackfillModule {
  constructor(
    @InjectRepository(Property) readonly repository: Repository<Property>,
    readonly exchangeRates: ExchangeRatesService,
  ) {}
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn'],
  });

  try {
    const { repository, exchangeRates } = app.get(BackfillModule);
    const store: BackfillStore = {
      findBatch: (afterId, size) =>
        repository
          .createQueryBuilder('property')
          .select([
            'property.id',
            'property.createdAt',
            'property.priceAmount',
            'property.priceCurrency',
            'property.priceEur',
          ])
          .where('property.id > :afterId', { afterId })
          .orderBy('property.id', 'ASC')
          .take(size)
          .getMany(),
      setPriceEur: async (id, priceEur) => {
        await repository.update({ id }, { priceEur });
      },
    };

    const result = await backfillPriceEur({
      store,
      getRates: (at) => exchangeRates.getConversionRates(at),
      dryRun,
    });

    console.log(
      `${dryRun ? '[dry run] ' : ''}scanned ${result.scanned}, ` +
        `${dryRun ? 'would change' : 'changed'} ${result.changed}, ` +
        `without a Euro Price ${result.empty}`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error('Backfill failed:', error.message);
  process.exitCode = 1;
});
