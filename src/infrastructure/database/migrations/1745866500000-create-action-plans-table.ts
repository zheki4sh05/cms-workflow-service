import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActionPlansTable1745866500000
  implements MigrationInterface
{
  name = 'CreateActionPlansTable1745866500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "action_plans" (
        "id" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "incidentId" uuid NOT NULL,
        "comment" text NOT NULL,
        CONSTRAINT "PK_action_plans_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_action_plans_case_id" UNIQUE ("caseId"),
        CONSTRAINT "FK_action_plans_case_id" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_action_plans_incident_id" FOREIGN KEY ("incidentId") REFERENCES "incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "action_plans"`);
  }
}
