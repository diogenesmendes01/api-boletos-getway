import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessorService } from '../src/imports/file-processor.service';
import * as path from 'path';
import * as fs from 'fs';

describe('File Fixtures Validation', () => {
  let service: FileProcessorService;
  const fixturesPath = path.join(__dirname, 'fixtures');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileProcessorService],
    }).compile();

    service = module.get<FileProcessorService>(FileProcessorService);
  });

  beforeAll(() => {
    // Ensure fixtures directory exists
    if (!fs.existsSync(fixturesPath)) {
      throw new Error(`Fixtures directory not found: ${fixturesPath}`);
    }
  });

  describe('Valid Sample CSV', () => {
    const validSamplePath = path.join(fixturesPath, 'valid-sample.csv');

    it('should exist and be readable', () => {
      expect(fs.existsSync(validSamplePath)).toBe(true);
      expect(fs.statSync(validSamplePath).isFile()).toBe(true);
    });

    it('should parse all rows successfully', async () => {
      const result = await service.parseFile(validSamplePath);

      expect(result).toHaveLength(5);
      
      // Validate first row
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

      // Validate currency formatting
      expect(result[2]).toEqual({
        nome: 'Pedro Oliveira',
        cnpj: '33444555000199',
        endereco: 'Av. Principal',
        numero: '789',
        bairro: 'Vila Nova',
        estado: 'MG',
        cep: '30123456',
        valor: 1550, // 15.50 converted to cents
        vencimento: '2024-11-15',
      });

      // Validate another CNPJ
      expect(result[3]).toEqual({
        nome: 'Ana Costa',
        cnpj: '44555666000177',
        endereco: 'Rua do Comércio',
        numero: '321',
        bairro: 'Centro',
        estado: 'RS',
        cep: '90123456',
        valor: 500,
        vencimento: '2024-11-15',
      });

      // Validate currency with R$ format
      expect(result[4]).toEqual({
        nome: 'Carlos Pereira',
        cnpj: '55666777000188',
        endereco: 'Rua Nova',
        numero: '555',
        bairro: 'Jardim',
        estado: 'PR',
        cep: '80123456',
        valor: 7500, // R$ 75,00 converted to cents
        vencimento: '2025-01-10',
      });
    });

    it('should handle different date formats', async () => {
      const result = await service.parseFile(validSamplePath);

      // ISO format
      expect(result[0].vencimento).toBe('2024-12-31');
      // Brazilian format
      expect(result[1].vencimento).toBe('2024-12-31');
    });

    it('should validate CEP format', async () => {
      const result = await service.parseFile(validSamplePath);

      result.forEach(row => {
        expect(row.cep).toMatch(/^\d{8}$/);
      });
    });
  });

  describe('Invalid Sample CSV', () => {
    const invalidSamplePath = path.join(fixturesPath, 'invalid-sample.csv');

    it('should exist and be readable', () => {
      expect(fs.existsSync(invalidSamplePath)).toBe(true);
      expect(fs.statSync(invalidSamplePath).isFile()).toBe(true);
    });

    it('should throw error for invalid amount', async () => {
      await expect(service.parseFile(invalidSamplePath))
        .rejects.toThrow(/Row 1.*Invalid amount/);
    });
  });

  describe('Mixed Formats CSV', () => {
    const mixedFormatsPath = path.join(fixturesPath, 'mixed-formats.csv');

    it('should exist and be readable', () => {
      expect(fs.existsSync(mixedFormatsPath)).toBe(true);
      expect(fs.statSync(mixedFormatsPath).isFile()).toBe(true);
    });

    it('should parse formatted data correctly', async () => {
      const result = await service.parseFile(mixedFormatsPath);

      expect(result).toHaveLength(5);

      // Test comma decimal format
      expect(result[0]).toEqual({
        amount: 150050, // 1,500.50 -> 1500.50 reais -> 150050 cents
        name: 'João da Silva',
        document: '11144477735', // CPF without formatting
        telefone: '5511987654321', // Phone normalized
        email: 'joao@example.com',
        vencimento: '2024-12-31',
      });

      // Test R$ currency format
      expect(result[1]).toEqual({
        amount: 200000, // R$ 2.000 -> 2000 reais -> 200000 cents
        name: 'Maria dos Santos',
        document: '22255588844',
        telefone: '5521988776655', // +55 normalized
        email: 'maria@example.com',
        vencimento: '2024-12-31',
      });

      // Test CNPJ formatting
      expect(result[2]).toEqual({
        amount: 1500, // 15 reais -> 1500 cents
        name: 'Pedro José Oliveira',
        document: '11222333000181', // CNPJ without formatting
        telefone: '551196432100', // Space removed
        email: 'pedro@example.com',
        vencimento: '2024-11-15',
      });

      // Test quoted decimal
      expect(result[3]).toEqual({
        amount: 1099, // "10,99" -> 10.99 reais -> 1099 cents
        name: 'Ana Maria Costa',
        document: '33366699977',
        telefone: '5585987654321',
        email: 'ana@example.com',
        vencimento: '2024-11-15',
      });

      // Test plain decimal
      expect(result[4]).toEqual({
        amount: 7500, // 75.00 -> 7500 cents
        name: 'Carlos Eduardo',
        document: '44477788811',
        telefone: '5547912345678',
        email: 'carlos@example.com',
        vencimento: '2025-01-10',
      });
    });
  });

  describe('Large Sample CSV', () => {
    const largeSamplePath = path.join(fixturesPath, 'large-sample.csv');

    it('should exist and be readable', () => {
      expect(fs.existsSync(largeSamplePath)).toBe(true);
      expect(fs.statSync(largeSamplePath).isFile()).toBe(true);
    });

    it('should parse large file efficiently', async () => {
      const startTime = Date.now();
      const result = await service.parseFile(largeSamplePath);
      const endTime = Date.now();

      expect(result).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // Should parse in less than 1 second

      // Validate first and last entries
      expect(result[0]).toEqual({
        nome: 'Cliente 001',
        cnpj: '11222333000181',
        endereco: 'Rua 001',
        numero: '001',
        bairro: 'Bairro 001',
        estado: 'SP',
        cep: '01000001',
        valor: 1000,
        vencimento: '2024-12-31',
      });

      expect(result[19]).toEqual({
        nome: 'Cliente 020',
        cnpj: '99888777000166',
        endereco: 'Rua 020',
        numero: '020',
        bairro: 'Bairro 020',
        estado: 'RJ',
        cep: '20000020',
        valor: 2900,
        vencimento: '2024-12-31',
      });
    });

    it('should maintain data integrity across all rows', async () => {
      const result = await service.parseFile(largeSamplePath);

      // Check that all amounts are incremental
      for (let i = 0; i < result.length; i++) {
        expect(result[i].valor).toBe(1000 + (i * 100));
        expect(result[i].nome).toBe(`Cliente ${String(i + 1).padStart(3, '0')}`);
        expect(result[i].vencimento).toBe('2024-12-31');
      }
    });
  });

  describe('File Size Validation', () => {
    it('should handle files within acceptable limits', () => {
      const files = [
        'valid-sample.csv',
        'invalid-sample.csv',
        'mixed-formats.csv',
        'large-sample.csv',
      ];

      files.forEach(filename => {
        const filePath = path.join(fixturesPath, filename);
        const stats = fs.statSync(filePath);
        
        // Each test file should be reasonable in size (< 10KB for test purposes)
        expect(stats.size).toBeLessThan(10 * 1024);
        expect(stats.size).toBeGreaterThan(0);
      });
    });
  });

  describe('CSV Format Validation', () => {
    it('should have correct headers in all files', () => {
      const files = [
        'valid-sample.csv',
        'invalid-sample.csv',
        'mixed-formats.csv',
        'large-sample.csv',
      ];

      const expectedHeader = 'amount,name,document,telefone,email,vencimento';

      files.forEach(filename => {
        const filePath = path.join(fixturesPath, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        
        expect(lines[0]).toBe(expectedHeader);
      });
    });

    it('should have consistent column count', () => {
      const files = [
        'valid-sample.csv',
        'mixed-formats.csv',
        'large-sample.csv',
      ];

      files.forEach(filename => {
        const filePath = path.join(fixturesPath, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        
        // Check that all lines have the same number of columns
        const expectedColumnCount = lines[0].split(',').length;
        
        lines.forEach((line, index) => {
          const columnCount = line.split(',').length;
          expect(columnCount).toBe(expectedColumnCount);
        });
      });
    });
  });
});