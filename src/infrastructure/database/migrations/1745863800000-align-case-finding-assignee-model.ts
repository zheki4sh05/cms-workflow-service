import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignCaseFindingAssigneeModel1745863800000
  implements MigrationInterface
{
  name = 'AlignCaseFindingAssigneeModel1745863800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases"
      RENAME COLUMN "responsibleUserId" TO "assignedUserId"
    `);

    await queryRunner.query(`
      ALTER TABLE "cases"
      DROP CONSTRAINT IF EXISTS "uq_cases_incident_assignee"
    `);

    await queryRunner.query(`
      ALTER TABLE "cases"
      ADD COLUMN IF NOT EXISTS "findingId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "findings"
      DROP CONSTRAINT IF EXISTS "FK_findings_case_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "findings"
      DROP COLUMN IF EXISTS "caseId"
    `);

    await queryRunner.query(`
      ALTER TABLE "cases"
      ADD CONSTRAINT "FK_cases_finding_id"
      FOREIGN KEY ("findingId") REFERENCES "findings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "cases"
      ADD CONSTRAINT "uq_cases_incident_assignee" UNIQUE ("incidentId", "findingId", "assignedUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases"
      DROP CONSTRAINT IF EXISTS "uq_cases_incident_assignee"
    `);

    await queryRunner.query(`
      ALTER TABLE "cases"
      DROP CONSTRAINT IF EXISTS "FK_cases_finding_id"
    `);

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

    await queryRunner.query(`
      ALTER TABLE "cases"
      DROP COLUMN IF EXISTS "findingId"
    `);

    await queryRunner.query(`
      ALTER TABLE "cases"
      RENAME COLUMN "assignedUserId" TO "responsibleUserId"
    `);

    await queryRunner.query(`
      ALTER TABLE "cases"
      ADD CONSTRAINT "uq_cases_incident_assignee" UNIQUE ("incidentId", "responsibleUserId")
    `);
  }
}
