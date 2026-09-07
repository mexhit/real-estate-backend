import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericColumnTransformer } from './numeric-column.transformer';

@Entity()
export class AreaPriceSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  @Index('IDX_area_price_snapshot_area_id')
  areaId: number;

  @Column({ type: 'timestamptz' })
  ranAt: Date;

  @Column({
    type: 'numeric',
    nullable: true,
    transformer: numericColumnTransformer,
  })
  avgPricePerSqm: number | null;

  @Column({ nullable: true })
  currency: string | null;

  @Column({ type: 'integer' })
  propertyCount: number;

  @Column({ type: 'integer' })
  excludedCount: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
