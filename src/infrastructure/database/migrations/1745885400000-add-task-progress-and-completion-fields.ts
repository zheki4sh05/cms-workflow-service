import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskProgressAndCompletionFields1745885400000 implements MigrationInterface {
  name = 'AddTaskProgressAndCompletionFields1745885400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      ADD COLUMN IF NOT EXISTS "evidenceDescriptionInprogress" text
    `);
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      ADD COLUMN IF NOT EXISTS "evidenceDescriptionDone" text
    `);
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      DROP COLUMN IF EXISTS "completedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      DROP COLUMN IF EXISTS "evidenceDescriptionDone"
    `);
    await queryRunner.query(`
      ALTER TABLE "action_plan_tasks"
      DROP COLUMN IF EXISTS "evidenceDescriptionInprogress"
    `);
  }
}
