import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_tokens')
export class UserToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  username: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  email: string;

  @Column({ type: 'text' })
  olympiaToken: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  companyName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  companyDocument: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
