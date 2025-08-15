import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessorService } from './file-processor.service';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs/promises');

describe('FileProcessorService', () => {
  let service: FileProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileProcessorService],
    }).compile();

    service = module.get<FileProcessorService>(FileProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseFile', () => {
    it('should parse CSV file correctly', async () => {
      const csvContent = `nome,cnpj,endereco,numero,bairro,estado,cep,valor,vencimento
João Silva,11222333000181,Rua das Flores,123,Centro,SP,01234567,1500,2024-12-31
Maria Santos,11444777000161,Av. Brasil,456,Jardins,RJ,23456789,2000,31/12/2024`;

      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(csvContent));

      const result = await service.parseFile('/tmp/test.csv');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        nome: 'João Silva',
        cnpj: '11222333000181',
        endereco: 'Rua das Flores',
        numero: '123',
        bairro: 'Centro',
        estado: 'SP',
        cep: '01234567',
        valor: 1500,
        vencimento: '2024-12-31',
      });
      expect(result[1]).toEqual({
        nome: 'Maria Santos',
        cnpj: '11444777000161',
        endereco: 'Av. Brasil',
        numero: '456',
        bairro: 'Jardins',
        estado: 'RJ',
        cep: '23456789',
        valor: 2000,
        vencimento: '2024-12-31',
      });
    });

    it('should throw error for unsupported file format', async () => {
      await expect(service.parseFile('/tmp/test.txt')).rejects.toThrow('Unsupported file format');
    });

    it('should handle validation errors', async () => {
      const csvContent = `amount,name,document,telefone,email,vencimento
invalid,João Silva,invalid,11987654321,joao@test.com,2024-12-31`;

      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(csvContent));

      await expect(service.parseFile('/tmp/test.csv')).rejects.toThrow();
    });
  });

  describe('validateCNPJ', () => {
    it('should validate correct CNPJ', () => {
      const result = service['validateCNPJ']('11222333000181');
      expect(result).toBe(true);
    });

    it('should reject CNPJ with all same digits', () => {
      const result = service['validateCNPJ']('11111111111111');
      expect(result).toBe(false);
    });

    it('should reject CNPJ with wrong check digits', () => {
      const result = service['validateCNPJ']('11222333000180');
      expect(result).toBe(false);
    });

    it('should reject CNPJ with wrong length', () => {
      const result = service['validateCNPJ']('1122233300018');
      expect(result).toBe(false);
    });
  });

  describe('parseAmount', () => {
    it('should parse integer as centavos when >= 100', () => {
      const amount = 1500;
      const result = service['parseAmount'](amount);
      expect(result).toBe(1500);
    });

    it('should parse small integer as reais to centavos', () => {
      const amount = 15;
      const result = service['parseAmount'](amount);
      expect(result).toBe(1500);
    });

    it('should parse decimal as reais to centavos', () => {
      const amount = 15.50;
      const result = service['parseAmount'](amount);
      expect(result).toBe(1550);
    });

    it('should parse string with comma', () => {
      const amount = '15,50';
      const result = service['parseAmount'](amount);
      expect(result).toBe(1550);
    });

    it('should parse string with dot', () => {
      const amount = '15.50';
      const result = service['parseAmount'](amount);
      expect(result).toBe(1550);
    });

    it('should parse string with currency symbols', () => {
      const amount = 'R$ 15,50';
      const result = service['parseAmount'](amount);
      expect(result).toBe(1550);
    });

    it('should handle zero value', () => {
      const result = service['parseAmount'](0);
      expect(result).toBe(0);
    });

    it('should reject non-numeric strings', () => {
      const result = service['parseAmount']('invalid');
      expect(result).toBeNull();
    });

    it('should reject null/undefined', () => {
      expect(service['parseAmount'](null)).toBeNull();
      expect(service['parseAmount'](undefined)).toBeNull();
    });
  });

  describe('parseDate', () => {
    it('should parse ISO date', () => {
      const date = '2024-12-31';
      const result = service['parseDate'](date);
      expect(result).toBe('2024-12-31');
    });

    it('should parse BR date format', () => {
      const date = '31/12/2024';
      const result = service['parseDate'](date);
      expect(result).toBe('2024-12-31');
    });

    it('should handle single digit days/months', () => {
      const date = '1/5/2024';
      const result = service['parseDate'](date);
      expect(result).toBe('2024-05-01');
    });

    it('should reject invalid date format', () => {
      const date = '2024/12/31';
      const result = service['parseDate'](date);
      expect(result).toBeNull();
    });

    it('should reject incomplete date', () => {
      const date = '31/12';
      const result = service['parseDate'](date);
      expect(result).toBeNull();
    });

    it('should reject empty date', () => {
      const result = service['parseDate']('');
      expect(result).toBeNull();
    });

    it('should handle date with extra whitespace', () => {
      const date = ' 31/12/2024 ';
      const result = service['parseDate'](date);
      expect(result).toBe('2024-12-31');
    });
  });
});