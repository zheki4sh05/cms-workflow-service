import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDetectedAtToFindings1746117060000 implements MigrationInterface {
  name = 'AddDetectedAtToFindings1746117060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "findings"
      ADD COLUMN IF NOT EXISTS "detectedAt" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "findings"
      DROP COLUMN IF EXISTS "detectedAt"
    `);
  }
}
