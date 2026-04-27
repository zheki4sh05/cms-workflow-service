import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToCases1745757600000 implements MigrationInterface {
  name = 'AddStatusToCases1745757600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases"
      ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'OPEN'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases"
      DROP COLUMN IF EXISTS "status"
    `);
  }
}
