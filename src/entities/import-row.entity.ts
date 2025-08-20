import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Import } from './import.entity';
import { Transaction } from './transaction.entity';

export enum RowStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error',
}

@Entity('import_rows')
export class ImportRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Import, import_ => import_.rows)
  @JoinColumn({ name: 'importId' })
  import: Import;

  @Column()
  importId: string;

  @Column()
  rowNumber: number;

  @Column()
  amount: number;

  @Column()
  name: string;

  @Column()
  document: string;

  @Column()
  telefone: string;

  @Column()
  email: string;

  @Column()
  vencimento: string;

  @Column({
    type: 'enum',
    enum: RowStatus,
    default: RowStatus.PENDING,
  })
  status: RowStatus;

  @Column({ nullable: true })
  errorCode: string;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => Transaction, transaction => transaction.importRow)
  transaction: Transaction;
}