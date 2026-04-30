import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActionPlanTaskEvidencesTable1745882400000 implements MigrationInterface {
  name = 'CreateActionPlanTaskEvidencesTable1745882400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "action_plan_task_evidences" (
        "id" uuid NOT NULL,
        "taskId" uuid NOT NULL,
        "userId" character varying(255) NOT NULL,
        "fileId" uuid NOT NULL,
        "name" character varying(500) NOT NULL,
        "time" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_action_plan_task_evidences_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_action_plan_task_evidences_task_id" FOREIGN KEY ("taskId") REFERENCES "action_plan_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "action_plan_task_evidences"`,
    );
  }
}
