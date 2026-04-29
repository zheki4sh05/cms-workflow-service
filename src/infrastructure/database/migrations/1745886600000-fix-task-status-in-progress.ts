import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTaskStatusInProgress1745886600000 implements MigrationInterface {
  name = 'FixTaskStatusInProgress1745886600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "action_plan_tasks"
      SET "status" = 'IN_PROGRESS'
      WHERE "status" = 'PREGRESS'
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      DROP CONSTRAINT IF EXISTS "CHK_action_plan_tasks_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      ADD CONSTRAINT "CHK_action_plan_tasks_status"
      CHECK ("status" IN ('TODO', 'IN_PROGRESS', 'DONE'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "action_plan_tasks"
      SET "status" = 'PREGRESS'
      WHERE "status" = 'IN_PROGRESS'
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
}
