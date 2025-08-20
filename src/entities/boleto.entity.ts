import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Empresa } from './empresa.entity';
import { Import } from './import.entity';

export enum BoletoStatus {
  PENDENTE = 'pendente',
  GERADO = 'gerado', 
  PAGO = 'pago',
  VENCIDO = 'vencido',
  CANCELADO = 'cancelado',
  ERRO = 'erro'
}

@Entity('boletos')
export class Boleto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true, comment: 'Número do boleto gerado pela OlympiaBank' })
  numeroBoleto: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: 'Valor do boleto' })
  valor: number;

  @Column({ type: 'date', comment: 'Data de vencimento do boleto' })
  vencimento: Date;

  @Column({ 
    type: 'enum', 
    enum: BoletoStatus, 
    default: BoletoStatus.PENDENTE,
    comment: 'Status atual do boleto'
  })
  status: BoletoStatus;

  @Column({ type: 'text', nullable: true, comment: 'URL do boleto para download/visualização' })
  urlBoleto: string;

  @Column({ type: 'text', nullable: true, comment: 'Mensagem de erro caso tenha ocorrido' })
  mensagemErro: string;

  @Column({ length: 14, comment: 'CNPJ da empresa (chave estrangeira)' })
  empresaCnpj: string;

  @Column({ type: 'uuid', comment: 'ID da importação que gerou este boleto' })
  importId: string;

  @Column({ type: 'int', comment: 'Número da linha na planilha original' })
  numeroLinha: number;

  @CreateDateColumn({ comment: 'Data de criação do registro' })
  createdAt: Date;

  @UpdateDateColumn({ comment: 'Data da última atualização' })
  updatedAt: Date;

  @ManyToOne(() => Empresa, empresa => empresa.boletos)
  @JoinColumn({ name: 'empresaCnpj', referencedColumnName: 'cnpj' })
  empresa: Empresa;

  @ManyToOne(() => Import, importEntity => importEntity.boletos)
  @JoinColumn({ name: 'importId' })
  importEntity: Import;
}