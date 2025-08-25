import { DataSource } from 'typeorm';
import { Import } from './src/entities/import.entity';
import { ImportRow } from './src/entities/import-row.entity';
import { Transaction } from './src/entities/transaction.entity';
import { Empresa } from './src/entities/empresa.entity';
import { Boleto } from './src/entities/boleto.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  // NÃO usar URL - usar variáveis individuais que funcionam
  host: process.env.DB_HOST || 'postgres-olympia',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'olympia_app',
  password: process.env.DB_PASSWORD || 'V/aMMGypweFPSlGivTdcaC44zzEZDfuv',
  database: process.env.DB_DATABASE || 'boleto_db',
  entities: [Import, ImportRow, Transaction, Empresa, Boleto], // ← Adicionar todas as entities
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});