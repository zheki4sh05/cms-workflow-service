import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVerificationsTable1745878800000 implements MigrationInterface {
  name = 'CreateVerificationsTable1745878800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "verifications" (
        "id" uuid NOT NULL,
        "actionPlanId" uuid NOT NULL,
        "verified" boolean NOT NULL DEFAULT false,
        "assignedUserForVerification" character varying(255) NOT NULL,
        "assignedEmployeeForVerification" character varying(255) NOT NULL,
        CONSTRAINT "PK_verifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_verifications_action_plan_id" UNIQUE ("actionPlanId"),
        CONSTRAINT "FK_verifications_action_plan_id" FOREIGN KEY ("actionPlanId") REFERENCES "action_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "verifications"`);
  }
}
