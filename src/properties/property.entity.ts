import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ default: false })
  seen: boolean;

  @Column({ default: false })
  bookmarked: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
