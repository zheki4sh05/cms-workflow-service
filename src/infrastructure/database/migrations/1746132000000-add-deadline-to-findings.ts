import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeadlineToFindings1746132000000 implements MigrationInterface {
  name = 'AddDeadlineToFindings1746132000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "findings"
      ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "findings"
      DROP COLUMN IF EXISTS "deadline"
    `);
  }
}
