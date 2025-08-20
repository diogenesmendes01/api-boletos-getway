import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmpresaAndBoletoTables1704100000000 implements MigrationInterface {
  name = 'CreateEmpresaAndBoletoTables1704100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar tabela empresas
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

    // Criar comentários para empresas
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."cnpj" IS 'CNPJ da empresa sem formatação (14 dígitos)'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."nome" IS 'Nome da empresa'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."endereco" IS 'Endereço da empresa'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."numero" IS 'Número do endereço'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."bairro" IS 'Bairro'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."estado" IS 'Estado (UF)'`);
    await queryRunner.query(`COMMENT ON COLUMN "empresas"."cep" IS 'CEP sem formatação (8 dígitos)'`);

    // Criar tabela boletos
    await queryRunner.query(`
      CREATE TYPE "public"."boletos_status_enum" AS ENUM('pendente', 'gerado', 'pago', 'vencido', 'cancelado', 'erro')
    `);

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

    // Criar comentários para boletos
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."numeroBoleto" IS 'Número do boleto gerado pela OlympiaBank'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."valor" IS 'Valor do boleto'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."vencimento" IS 'Data de vencimento do boleto'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."status" IS 'Status atual do boleto'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."urlBoleto" IS 'URL do boleto para download/visualização'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."mensagemErro" IS 'Mensagem de erro caso tenha ocorrido'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."empresaCnpj" IS 'CNPJ da empresa (chave estrangeira)'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."importId" IS 'ID da importação que gerou este boleto'`);
    await queryRunner.query(`COMMENT ON COLUMN "boletos"."numeroLinha" IS 'Número da linha na planilha original'`);

    // Criar chaves estrangeiras
    await queryRunner.query(`
      ALTER TABLE "boletos" 
      ADD CONSTRAINT "FK_boletos_empresaCnpj" 
      FOREIGN KEY ("empresaCnpj") REFERENCES "empresas"("cnpj") ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "boletos" 
      ADD CONSTRAINT "FK_boletos_importId" 
      FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // Criar índices
    await queryRunner.query(`CREATE INDEX "IDX_boletos_empresaCnpj" ON "boletos" ("empresaCnpj")`);
    await queryRunner.query(`CREATE INDEX "IDX_boletos_importId" ON "boletos" ("importId")`);
    await queryRunner.query(`CREATE INDEX "IDX_boletos_status" ON "boletos" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_boletos_vencimento" ON "boletos" ("vencimento")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover chaves estrangeiras
    await queryRunner.query(`ALTER TABLE "boletos" DROP CONSTRAINT "FK_boletos_importId"`);
    await queryRunner.query(`ALTER TABLE "boletos" DROP CONSTRAINT "FK_boletos_empresaCnpj"`);

    // Remover índices
    await queryRunner.query(`DROP INDEX "IDX_boletos_vencimento"`);
    await queryRunner.query(`DROP INDEX "IDX_boletos_status"`);
    await queryRunner.query(`DROP INDEX "IDX_boletos_importId"`);
    await queryRunner.query(`DROP INDEX "IDX_boletos_empresaCnpj"`);

    // Remover tabelas
    await queryRunner.query(`DROP TABLE "boletos"`);
    await queryRunner.query(`DROP TYPE "public"."boletos_status_enum"`);
    await queryRunner.query(`DROP TABLE "empresas"`);
  }
}