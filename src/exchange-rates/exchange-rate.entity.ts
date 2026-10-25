import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericColumnTransformer } from '../areas/numeric-column.transformer';

export const EXCHANGE_RATE_CURRENCIES = ['EUR', 'USD'] as const;
export type ExchangeRateCurrency = (typeof EXCHANGE_RATE_CURRENCIES)[number];

export const EXCHANGE_RATE_QUOTE_CURRENCY = 'ALL';

@Entity()
@Index(
  'IDX_exchange_rate_currency_source_fetched_at',
  ['currency', 'source', 'fetchedAt'],
  { unique: true },
)
export class ExchangeRate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  currency: ExchangeRateCurrency;

  @Column()
  quoteCurrency: string;

  @Column({ type: 'numeric', transformer: numericColumnTransformer })
  buy: number;

  @Column({ type: 'numeric', transformer: numericColumnTransformer })
  sell: number;

  @Column()
  source: string;

  @Column({ type: 'timestamptz' })
  fetchedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
