import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704000000000 implements MigrationInterface {
  name = 'InitialSchema1704000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."imports_status_enum" AS ENUM('queued', 'processing', 'completed', 'failed')
    `);
    
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

    await queryRunner.query(`
      CREATE TYPE "public"."import_rows_status_enum" AS ENUM('pending', 'processing', 'success', 'error')
    `);

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

    await queryRunner.query(`
      ALTER TABLE "import_rows" 
      ADD CONSTRAINT "FK_import_rows_import" 
      FOREIGN KEY ("importId") REFERENCES "imports"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions" 
      ADD CONSTRAINT "FK_transactions_import_row" 
      FOREIGN KEY ("importRowId") REFERENCES "import_rows"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`CREATE INDEX "IDX_imports_status" ON "imports" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_imports_owner" ON "imports" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_import_rows_import" ON "import_rows" ("importId")`);
    await queryRunner.query(`CREATE INDEX "IDX_import_rows_status" ON "import_rows" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_import_rows_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_import_rows_import"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_imports_owner"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_imports_status"`);
    
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_import_row"`);
    await queryRunner.query(`ALTER TABLE "import_rows" DROP CONSTRAINT "FK_import_rows_import"`);
    
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "import_rows"`);
    await queryRunner.query(`DROP TABLE "imports"`);
    
    await queryRunner.query(`DROP TYPE "public"."import_rows_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."imports_status_enum"`);
  }
}