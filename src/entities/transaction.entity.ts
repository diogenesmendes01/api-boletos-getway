import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ImportRow } from './import-row.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => ImportRow, row => row.transaction)
  @JoinColumn({ name: 'importRowId' })
  importRow: ImportRow;

  @Column()
  importRowId: string;

  @Column()
  idTransaction: string;

  @Column()
  boletoUrl: string;

  @Column()
  boletoCode: string;

  @Column({ type: 'text' })
  pdf: string;

  @Column()
  dueDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
