import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Boleto, BoletoStatus } from '../entities/boleto.entity';

interface CreateBoletoData {
  numeroBoleto: string;
  valor: number;
  vencimento: Date;
  empresaCnpj: string;
  importId: string;
  numeroLinha: number;
  urlBoleto?: string;
  status?: BoletoStatus;
}

interface UpdateBoletoData {
  numeroBoleto?: string;
  status?: BoletoStatus;
  urlBoleto?: string;
  mensagemErro?: string;
}

@Injectable()
export class BoletoService {
  constructor(
    @InjectRepository(Boleto)
    private boletoRepository: Repository<Boleto>,
  ) {}

  async create(boletoData: CreateBoletoData): Promise<Boleto> {
    const boleto = this.boletoRepository.create({
      ...boletoData,
      status: boletoData.status || BoletoStatus.PENDENTE,
    });
    return this.boletoRepository.save(boleto);
  }

  async update(id: string, updateData: UpdateBoletoData): Promise<Boleto> {
    await this.boletoRepository.update(id, updateData);
    const boleto = await this.findById(id);
    if (!boleto) {
      throw new Error(`Boleto com ID ${id} não encontrado`);
    }
    return boleto;
  }

  async updateByNumeroBoleto(
    numeroBoleto: string,
    updateData: UpdateBoletoData,
  ): Promise<Boleto> {
    await this.boletoRepository.update({ numeroBoleto }, updateData);
    const boleto = await this.findByNumeroBoleto(numeroBoleto);
    if (!boleto) {
      throw new Error(`Boleto com número ${numeroBoleto} não encontrado`);
    }
    return boleto;
  }

  async findById(id: string): Promise<Boleto | null> {
    return this.boletoRepository.findOne({
      where: { id },
      relations: ['empresa'],
    });
  }

  async findByNumeroBoleto(numeroBoleto: string): Promise<Boleto | null> {
    return this.boletoRepository.findOne({
      where: { numeroBoleto },
      relations: ['empresa'],
    });
  }

  async findByImportId(importId: string): Promise<Boleto[]> {
    return this.boletoRepository.find({
      where: { importId },
      relations: ['empresa'],
      order: { numeroLinha: 'ASC' },
    });
  }

  async findByEmpresaCnpj(empresaCnpj: string): Promise<Boleto[]> {
    return this.boletoRepository.find({
      where: { empresaCnpj },
      relations: ['empresa'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: BoletoStatus): Promise<Boleto[]> {
    return this.boletoRepository.find({
      where: { status },
      relations: ['empresa'],
      order: { createdAt: 'DESC' },
    });
  }

  async countByImportId(importId: string): Promise<{
    total: number;
    pendentes: number;
    gerados: number;
    pagos: number;
    erros: number;
  }> {
    const [total, pendentes, gerados, pagos, erros] = await Promise.all([
      this.boletoRepository.count({ where: { importId } }),
      this.boletoRepository.count({
        where: { importId, status: BoletoStatus.PENDENTE },
      }),
      this.boletoRepository.count({
        where: { importId, status: BoletoStatus.GERADO },
      }),
      this.boletoRepository.count({
        where: { importId, status: BoletoStatus.PAGO },
      }),
      this.boletoRepository.count({
        where: { importId, status: BoletoStatus.ERRO },
      }),
    ]);

    return { total, pendentes, gerados, pagos, erros };
  }

  async markAsGerado(
    id: string,
    numeroBoleto: string,
    urlBoleto: string,
  ): Promise<Boleto> {
    return this.update(id, {
      numeroBoleto,
      urlBoleto,
      status: BoletoStatus.GERADO,
    });
  }

  async markAsErro(id: string, mensagemErro: string): Promise<Boleto> {
    return this.update(id, {
      status: BoletoStatus.ERRO,
      mensagemErro,
    });
  }

  async findAll(): Promise<Boleto[]> {
    return this.boletoRepository.find({
      relations: ['empresa'],
      order: { createdAt: 'DESC' },
    });
  }
}
