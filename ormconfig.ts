import { DataSource } from 'typeorm';
import { Import } from './src/entities/import.entity';
import { ImportRow } from './src/entities/import-row.entity';
import { Transaction } from './src/entities/transaction.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.POSTGRES_URL || 'postgres://boletos_user:boletos_pass@localhost:5432/boletos_db',
  entities: [Import, ImportRow, Transaction],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});