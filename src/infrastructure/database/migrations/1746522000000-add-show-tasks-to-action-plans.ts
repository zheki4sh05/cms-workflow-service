import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShowTasksToActionPlans1746522000000
  implements MigrationInterface
{
  name = 'AddShowTasksToActionPlans1746522000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_plans" ADD "showTasks" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_plans" DROP COLUMN "showTasks"`,
    );
  }
}
