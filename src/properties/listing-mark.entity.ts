import { Column, Entity, PrimaryColumn } from 'typeorm';

export const LISTING_MARK_STATUSES = ['bookmarked', 'dismissed'] as const;

export type ListingMarkStatus = (typeof LISTING_MARK_STATUSES)[number];

@Entity('listing_mark')
export class ListingMark {
  @PrimaryColumn()
  providerId: string;

  @Column({ type: 'varchar' })
  status: ListingMarkStatus;
}
