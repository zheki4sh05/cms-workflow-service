import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentsToVerifications1745880600000 implements MigrationInterface {
  name = 'AddCommentsToVerifications1745880600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "verifications"
      ADD COLUMN IF NOT EXISTS "comments" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "verifications"
      DROP COLUMN IF EXISTS "comments"
    `);
  }
}
