import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Boleto } from './boleto.entity';

@Entity('empresas')
export class Empresa {
  @PrimaryColumn({ length: 14, comment: 'CNPJ da empresa sem formatação (14 dígitos)' })
  cnpj: string;

  @Column({ length: 255, comment: 'Nome da empresa' })
  nome: string;

  @Column({ length: 255, comment: 'Endereço da empresa' })
  endereco: string;

  @Column({ length: 10, comment: 'Número do endereço' })
  numero: string;

  @Column({ length: 100, comment: 'Bairro' })
  bairro: string;

  @Column({ length: 2, comment: 'Estado (UF)' })
  estado: string;

  @Column({ length: 8, comment: 'CEP sem formatação (8 dígitos)' })
  cep: string;

  @CreateDateColumn({ comment: 'Data de criação do registro' })
  createdAt: Date;

  @UpdateDateColumn({ comment: 'Data da última atualização' })
  updatedAt: Date;

  @OneToMany(() => Boleto, boleto => boleto.empresa)
  boletos: Boleto[];
}