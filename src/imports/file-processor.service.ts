import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as csvParse from 'csv-parse/sync';
import * as XLSX from 'xlsx';

interface ParsedRow {
  nome: string;
  cnpj: string;
  endereco: string;
  numero: string;
  bairro: string;
  estado: string;
  cep: string;
  valor: number;
  vencimento: string;
}

@Injectable()
export class FileProcessorService {
  async parseFile(filePath: string): Promise<ParsedRow[]> {
    const fileContent = await fs.readFile(filePath);
    const extension = filePath.split('.').pop()?.toLowerCase();

    let rawRows: any[];

    if (extension === 'csv') {
      rawRows = csvParse.parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const workbook = XLSX.read(fileContent, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawRows = XLSX.utils.sheet_to_json(worksheet);
    } else {
      throw new Error('Unsupported file format');
    }

    return rawRows.map((row, index) =>
      this.validateAndTransformRow(row, index + 1),
    );
  }

  private validateAndTransformRow(row: any, rowNumber: number): ParsedRow {
    const errors: string[] = [];

    // Validar nome
    const nome = row.nome?.trim();
    if (!nome) {
      errors.push('Nome é obrigatório');
    }

    // Validar CNPJ
    const cnpj = this.validateCNPJ_Only(row.CNPJ || row.cnpj);
    if (!cnpj) {
      errors.push('CNPJ inválido');
    }

    // Validar endereço
    const endereco = row.endereco?.trim();
    if (!endereco) {
      errors.push('Endereço é obrigatório');
    }

    // Validar número
    const numero = row.numero?.toString().trim();
    if (!numero) {
      errors.push('Número é obrigatório');
    }

    // Validar bairro
    const bairro = row.bairro?.trim();
    if (!bairro) {
      errors.push('Bairro é obrigatório');
    }

    // Validar estado (UF)
    const estado = row.estado?.trim().toUpperCase();
    if (!estado || !/^[A-Z]{2}$/.test(estado)) {
      errors.push('Estado deve ter 2 letras (UF)');
    }

    // Validar CEP
    const cep = this.validateCEP(row.CEP || row.cep);
    if (!cep) {
      errors.push('CEP inválido');
    }

    // Validar valor
    const valor = this.parseAmount(row.valor);
    if (valor === null) {
      errors.push('Valor inválido');
    }

    // Validar vencimento
    const vencimento = this.parseDate(row.vencimento);
    if (!vencimento) {
      errors.push('Data de vencimento inválida');
    }

    if (errors.length > 0) {
      throw new Error(`Linha ${rowNumber}: ${errors.join(', ')}`);
    }

    return {
      nome: nome!,
      cnpj: cnpj!,
      endereco: endereco!,
      numero: numero!,
      bairro: bairro!,
      estado: estado!,
      cep: cep!,
      valor: valor!,
      vencimento: vencimento!,
    };
  }

  private parseAmount(value: any): number | null {
    if (typeof value === 'number') {
      if (value < 100) {
        return Math.round(value * 100);
      }
      return Math.round(value);
    }

    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.,]/g, '');
      const normalized = cleaned.replace(',', '.');
      const parsed = parseFloat(normalized);

      if (isNaN(parsed)) return null;

      if (parsed < 100) {
        return Math.round(parsed * 100);
      }
      return Math.round(parsed);
    }

    return null;
  }

  private validateCNPJ_Only(value: any): string | null {
    if (!value) return null;

    const cleaned = String(value).replace(/\D/g, '');

    if (cleaned.length === 14) {
      return this.validateCNPJ(cleaned) ? cleaned : null;
    }

    return null;
  }

  private validateCEP(value: any): string | null {
    if (!value) return null;

    const cleaned = String(value).replace(/\D/g, '');

    if (cleaned.length === 8) {
      return cleaned;
    }

    return null;
  }

  private validateCNPJ(cnpj: string): boolean {
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj.charAt(i)) * weights1[i];
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (digit1 !== parseInt(cnpj.charAt(12))) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj.charAt(i)) * weights2[i];
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    if (digit2 !== parseInt(cnpj.charAt(13))) return false;

    return true;
  }

  private parseDate(value: any): string | null {
    if (!value) return null;

    const dateStr = String(value).trim();

    // ISO format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Brazilian format: DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
}
