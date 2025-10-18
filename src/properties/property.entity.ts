import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  providerId: string;

  @Column()
  description: string;

  @Column()
  price: string;
}
