import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchemaComplete1704000000000 implements MigrationInterface {
  name = 'InitialSchemaComplete1704000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==========================================
    // CRIAR TIPOS ENUM
    // ==========================================
    await queryRunner.query(`
      CREATE TYPE "public"."imports_status_enum" AS ENUM('queued', 'processing', 'completed', 'failed')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."import_rows_status_enum" AS ENUM('pending', 'processing', 'success', 'error')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."boletos_status_enum" AS ENUM('pendente', 'gerado', 'pago', 'vencido', 'cancelado', 'erro')
    `);

    // ==========================================
    // CRIAR TABELA IMPORTS
    // ==========================================
    await queryRunner.query(`
      CREATE TABLE "imports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" character varying NOT NULL,
        "originalFilename" character varying NOT NULL,
        "status" "public"."imports_status_enum" NOT NULL DEFAULT 'queued',
        "totalRows" integer NOT NULL DEFAULT '0',
        "processedRows" integer NOT NULL DEFAULT '0',
        "successRows" integer NOT NULL DEFAULT '0',
        "errorRows" integer NOT NULL DEFAULT '0',
        "webhookUrl" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "startedAt" TIMESTAMP,
        "finishedAt" TIMESTAMP,
        CONSTRAINT "PK_imports" PRIMARY KEY ("id")
      )
    `);

    // ==========================================
    // CRIAR TABELA IMPORT_ROWS
    // ==========================================
    await queryRunner.query(`
      CREATE TABLE "import_rows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "importId" uuid NOT NULL,
        "rowNumber" integer NOT NULL,
        "amount" integer NOT NULL,
        "name" character varying NOT NULL,
        "document" character varying NOT NULL,
        "telefone" character varying NOT NULL,
        "email" character varying NOT NULL,
        "vencimento" character varying NOT NULL,
        "status" "public"."import_rows_status_enum" NOT NULL DEFAULT 'pending',
        "errorCode" character varying,
        "errorMessage" character varying,
        "retryCount" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_rows" PRIMARY KEY ("id")
      )
    `);

    // ==========================================
    // CRIAR TABELA TRANSACTIONS
    // ==========================================
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "importRowId" uuid NOT NULL,
        "idTransaction" character varying NOT NULL,
        "boletoUrl" character varying NOT NULL,
        "boletoCode" character varying NOT NULL,
        "pdf" text NOT NULL,
        "dueDate" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "REL_transaction_import_row" UNIQUE ("importRowId")
      )
    `);

    // ==========================================
    // CRIAR TABELA EMPRESAS
    // ==========================================
    await queryRunner.query(`
      CREATE TABLE "empresas" (
        "cnpj" character varying(14) NOT NULL,
        "nome" character varying(255) NOT NULL,
        "endereco" character varying(255) NOT NULL,
        "numero" character varying(10) NOT NULL,
        "bairro" character varying(100) NOT NULL,
        "estado" character varying(2) NOT NULL,
        "cep" character varying(8) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_empresas_cnpj" PRIMARY KEY ("cnpj")
      )
    `);

    // ==========================================
    // CRIAR TABELA BOLETOS
    // ==========================================
    await queryRunner.query(`
      CREATE TABLE "boletos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "numeroBoleto" character varying(100) NOT NULL,
        "valor" numeric(10,2) NOT NULL,
        "vencimento" date NOT NULL,
        "status" "public"."boletos_status_enum" NOT NULL DEFAULT 'pendente',
        "urlBoleto" text,
        "mensagemErro" text,
        "empresaCnpj" character varying(14) NOT NULL,
        "importId" uuid NOT NULL,
        "numeroLinha" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_boletos_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_boletos_numeroBoleto" UNIQUE ("numeroBoleto")
      )
    `);

    // ==========================================
    // CRIAR COMENTÁRIOS PARA EMPRESAS
    // ==========================================
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."cnpj" IS 'CNPJ da empresa sem formatação (14 dígitos)'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."nome" IS 'Nome da empresa'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."endereco" IS 'Endereço da empresa'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."numero" IS 'Número do endereço'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."bairro" IS 'Bairro'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."estado" IS 'Estado (UF)'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."cep" IS 'CEP sem formatação (8 dígitos)'`);

    // ==========================================
    // CRIAR COMENTÁRIOS PARA BOLETOS
    // ==========================================
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."numeroBoleto" IS 'Número do boleto gerado pela OlympiaBank'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."valor" IS 'Valor do boleto'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."vencimento" IS 'Data de vencimento do boleto'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."status" IS 'Status atual do boleto'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."urlBoleto" IS 'URL do boleto para download/visualização'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."mensagemErro" IS 'Mensagem de erro caso tenha ocorrido'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."empresaCnpj" IS 'CNPJ da empresa (chave estrangeira)'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."importId" IS 'ID da importação que gerou este boleto'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."numeroLinha" IS 'Número da linha na planilha original'`);

    // ==========================================
    // CRIAR CHAVES ESTRANGEIRAS
    // ==========================================
    
    // import_rows -> imports
    await queryRunner.query(`
      ALTER TABLE "import_rows" 
      ADD CONSTRAINT "FK_import_rows_import" 
      FOREIGN KEY ("importId") REFERENCES "imports"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // transactions -> import_rows
    await queryRunner.query(`
      ALTER TABLE "transactions" 
      ADD CONSTRAINT "FK_transactions_import_row" 
      FOREIGN KEY ("importRowId") REFERENCES "import_rows"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // boletos -> empresas
    await queryRunner.query(`
      ALTER TABLE "boletos" 
      ADD CONSTRAINT "FK_boletos_empresaCnpj" 
      FOREIGN KEY ("empresaCnpj") REFERENCES "empresas"("cnpj") 
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // boletos -> imports
    await queryRunner.query(`
      ALTER TABLE "boletos" 
      ADD CONSTRAINT "FK_boletos_importId" 
      FOREIGN KEY ("importId") REFERENCES "imports"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // ==========================================
    // CRIAR ÍNDICES
    // ==========================================
    
    // Índices para imports
    await queryRunner.query(`CREATE INDEX "IDX_imports_status" ON "imports" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_imports_owner" ON "imports" ("ownerId")`);
    
    // Índices para import_rows
    await queryRunner.query(`CREATE INDEX "IDX_import_rows_import" ON "import_rows" ("importId")`);
    await queryRunner.query(`CREATE INDEX "IDX_import_rows_status" ON "import_rows" ("status")`);
    
    // Índices para boletos
    await queryRunner.query(`CREATE INDEX "IDX_boletos_empresaCnpj" ON "boletos" ("empresaCnpj")`);
    await queryRunner.query(`CREATE INDEX "IDX_boletos_importId" ON "boletos" ("importId")`);
    await queryRunner.query(`CREATE INDEX "IDX_boletos_status" ON "boletos" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_boletos_vencimento" ON "boletos" ("vencimento")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ==========================================
    // REMOVER ÍNDICES
    // ==========================================
    await queryRunner.query(`DROP INDEX "public"."IDX_boletos_vencimento"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_boletos_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_boletos_importId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_boletos_empresaCnpj"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_import_rows_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_import_rows_import"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_imports_owner"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_imports_status"`);
    
    // ==========================================
    // REMOVER CHAVES ESTRANGEIRAS
    // ==========================================
    await queryRunner.query(`ALTER TABLE "boletos" DROP CONSTRAINT "FK_boletos_importId"`);
    await queryRunner.query(`ALTER TABLE "boletos" DROP CONSTRAINT "FK_boletos_empresaCnpj"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_import_row"`);
    await queryRunner.query(`ALTER TABLE "import_rows" DROP CONSTRAINT "FK_import_rows_import"`);
    
    // ==========================================
    // REMOVER TABELAS (em ordem de dependência)
    // ==========================================
    await queryRunner.query(`DROP TABLE "boletos"`);
    await queryRunner.query(`DROP TABLE "empresas"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "import_rows"`);
    await queryRunner.query(`DROP TABLE "imports"`);
    
    // ==========================================
    // REMOVER TIPOS ENUM
    // ==========================================
    await queryRunner.query(`DROP TYPE "public"."boletos_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."import_rows_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."imports_status_enum"`);
  }
}