import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToActionPlanTasks1745883900000 implements MigrationInterface {
  name = 'AddStatusToActionPlanTasks1745883900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'TODO'
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      DROP CONSTRAINT IF EXISTS "CHK_action_plan_tasks_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      ADD CONSTRAINT "CHK_action_plan_tasks_status"
      CHECK ("status" IN ('TODO', 'PREGRESS', 'DONE'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      DROP CONSTRAINT IF EXISTS "CHK_action_plan_tasks_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      DROP COLUMN IF EXISTS "status"
    `);
  }
}
