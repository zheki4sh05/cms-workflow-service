import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToActionPlanTasks1745883600000
  implements MigrationInterface
{
  name = 'AddStatusToActionPlanTasks1745883600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'TODO'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      DROP COLUMN IF EXISTS "status"
    `);
  }
}
