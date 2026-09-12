import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('property_edit_history')
export class PropertyEditHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index('IDX_property_edit_history_property_id')
  propertyId: number;

  @Column()
  userId: number;

  @Column()
  field: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  editedAt: Date;
}
