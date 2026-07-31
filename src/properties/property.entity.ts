import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PROPERTY_TYPES = [
  'APARTMENT_1_1',
  'APARTMENT_2_1',
  'APARTMENT_3_1',
  'STUDIO',
  'PRIVATE_HOUSE',
  'VILLA',
  'OFFICE',
  'LAND',
  'PARKING',
  'SHOP',
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export function normalizePropertyType(value: unknown): PropertyType | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (PROPERTY_TYPES.includes(trimmed as PropertyType)) {
    return trimmed as PropertyType;
  }

  return null;
}

@Index('IDX_property_provider_id_id', ['providerId', 'id'])
@Index('IDX_property_provider_id_price', ['providerId', 'price'])
@Entity()
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index('IDX_property_provider_id')
  providerId: string;

  @Column()
  title: string;

  @Column()
  url: string;

  @Column()
  description: string;

  @Column()
  price: string;

  @Column({ type: 'integer', nullable: true })
  priceAmount: number | null;

  @Column({ nullable: true })
  priceCurrency: string | null;

  @Column({ type: 'integer', nullable: true })
  squareMeters: number | null;

  @Column({ nullable: true })
  @Index('IDX_property_property_type')
  propertyType: PropertyType | null;

  @Column({ type: 'text', nullable: true })
  aiResponseError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  aiMetadataUpdatedAt: Date | null;

  @Column({ default: false })
  @Index('IDX_property_seen')
  seen: boolean;

  @Column({ default: false })
  @Index('IDX_property_bookmarked')
  bookmarked: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index('IDX_property_created_at')
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
