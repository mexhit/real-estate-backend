import {
  Column,
  Entity,
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

@Entity()
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
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
  propertyType: PropertyType | null;

  @Column({ default: false })
  seen: boolean;

  @Column({ default: false })
  bookmarked: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
