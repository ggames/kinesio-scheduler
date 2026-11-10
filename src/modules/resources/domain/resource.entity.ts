import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ default: true })
  isAvailable: boolean;
}
