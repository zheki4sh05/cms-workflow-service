import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToCases1745757600000 implements MigrationInterface {
  name = 'AddStatusToCases1745757600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases"
      ADD COLUMN IF NOT EXISTS "status" character varying(20)
    `);

    await queryRunner.query(`
      UPDATE "cases"
      SET "status" = 'OPEN'
      WHERE "status" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "cases"
      ALTER COLUMN "status" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases"
      DROP COLUMN IF EXISTS "status"
    `);
  }
}
