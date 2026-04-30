import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropLegacyFindingsCaseId1745867400000 implements MigrationInterface {
  name = 'DropLegacyFindingsCaseId1745867400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "findings"
      DROP CONSTRAINT IF EXISTS "FK_findings_case_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "findings"
      DROP COLUMN IF EXISTS "caseId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "findings"
      ADD COLUMN IF NOT EXISTS "caseId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "findings"
      ADD CONSTRAINT "FK_findings_case_id"
      FOREIGN KEY ("caseId") REFERENCES "cases"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }
}
