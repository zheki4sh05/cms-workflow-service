import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionPlanTasksAndFields1745874300000
  implements MigrationInterface
{
  name = 'AddActionPlanTasksAndFields1745874300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "action_plans"
      ADD COLUMN IF NOT EXISTS "title" character varying(500)
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plans"
      ADD COLUMN IF NOT EXISTS "description" text
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plans"
      ALTER COLUMN "comment" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "action_plan_tasks" (
        "id" uuid NOT NULL,
        "actionPlanId" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "priority" character varying(20) NOT NULL,
        "dueDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_action_plan_tasks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_action_plan_tasks_action_plan_id" FOREIGN KEY ("actionPlanId") REFERENCES "action_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "action_plan_tasks"`);

    await queryRunner.query(`
      ALTER TABLE "action_plans"
      DROP COLUMN IF EXISTS "description"
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plans"
      DROP COLUMN IF EXISTS "title"
    `);

    await queryRunner.query(`
      ALTER TABLE "action_plans"
      ALTER COLUMN "comment" SET NOT NULL
    `);
  }
}
