import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvestigationsTable1745877000000
  implements MigrationInterface
{
  name = 'CreateInvestigationsTable1745877000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investigations" (
        "id" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "investigationNotes" text NOT NULL,
        "rootCause" text NOT NULL,
        "requiresCorrectiveAction" boolean NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_investigations_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_investigations_case_id" UNIQUE ("caseId"),
        CONSTRAINT "FK_investigations_case_id" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "investigations"`);
  }
}
