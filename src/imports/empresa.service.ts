import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from '../entities/empresa.entity';

interface EmpresaData {
  cnpj: string;
  nome: string;
  endereco: string;
  numero: string;
  bairro: string;
  estado: string;
  cep: string;
}

@Injectable()
export class EmpresaService {
  constructor(
    @InjectRepository(Empresa)
    private empresaRepository: Repository<Empresa>,
  ) {}

  async findOrCreateEmpresa(empresaData: EmpresaData): Promise<Empresa> {
    // Tentar encontrar a empresa pelo CNPJ
    let empresa = await this.empresaRepository.findOne({
      where: { cnpj: empresaData.cnpj }
    });

    if (!empresa) {
      // Se não existe, criar uma nova empresa
      empresa = this.empresaRepository.create(empresaData);
      await this.empresaRepository.save(empresa);
    } else {
      // Se existe, atualizar os dados (caso tenham mudado)
      const updated = Object.assign(empresa, empresaData);
      await this.empresaRepository.save(updated);
      empresa = updated;
    }

    return empresa;
  }

  async findByCnpj(cnpj: string): Promise<Empresa | null> {
    return this.empresaRepository.findOne({
      where: { cnpj }
    });
  }

  async create(empresaData: EmpresaData): Promise<Empresa> {
    const empresa = this.empresaRepository.create(empresaData);
    return this.empresaRepository.save(empresa);
  }

  async update(cnpj: string, empresaData: Partial<EmpresaData>): Promise<Empresa> {
    await this.empresaRepository.update(cnpj, empresaData);
    const empresa = await this.findByCnpj(cnpj);
    if (!empresa) {
      throw new Error(`Empresa com CNPJ ${cnpj} não encontrada`);
    }
    return empresa;
  }

  async findAll(): Promise<Empresa[]> {
    return this.empresaRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async countEmpresas(): Promise<number> {
    return this.empresaRepository.count();
  }
}