// One-off: recompute Euro Price for every existing Capture.
//   node -r dotenv/config dist/properties/backfill-price-eur.js [--dry-run] [--this-month]
// --this-month only touches Captures created since the 1st of the current
// month (Europe/Tirane).
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
  const thisMonth = process.argv.includes('--this-month');
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
          .andWhere(
            thisMonth
              ? `property."createdAt" >= date_trunc('month', now() AT TIME ZONE 'Europe/Tirane') AT TIME ZONE 'Europe/Tirane'`
              : '1 = 1',
          )
          .orderBy('property.id', 'ASC')
          .take(size)
          .getMany(),
      applyChanges: async (changes) => {
        // One UPDATE per batch: each row gets its own value.
        await repository.query(
          `UPDATE property SET "priceEur" = v."priceEur"::integer
           FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS "priceEur") v
           WHERE property.id = v.id`,
          [changes.map((c) => c.id), changes.map((c) => c.priceEur)],
        );
      },
    };

    const lookup = await exchangeRates.getConversionRateLookup();
    const result = await backfillPriceEur({
      store,
      getRates: lookup,
      dryRun,
    });

    console.log(
      `${dryRun ? '[dry run] ' : ''}${thisMonth ? '[this month] ' : ''}scanned ${result.scanned}, ` +
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
