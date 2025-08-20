import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ImportRow } from './import-row.entity';
import { Boleto } from './boleto.entity';

export enum ImportStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('imports')
export class Import {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column()
  originalFilename: string;

  @Column({
    type: 'enum',
    enum: ImportStatus,
    default: ImportStatus.QUEUED,
  })
  status: ImportStatus;

  @Column({ default: 0 })
  totalRows: number;

  @Column({ default: 0 })
  processedRows: number;

  @Column({ default: 0 })
  successRows: number;

  @Column({ default: 0 })
  errorRows: number;

  @Column({ nullable: true })
  webhookUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  finishedAt: Date;

  @OneToMany(() => ImportRow, row => row.import)
  rows: ImportRow[];

  @OneToMany(() => Boleto, boleto => boleto.importEntity)
  boletos: Boleto[];
}