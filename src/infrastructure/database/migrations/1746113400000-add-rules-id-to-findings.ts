import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRulesIdToFindings1746113400000 implements MigrationInterface {
  name = 'AddRulesIdToFindings1746113400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "findings"
      ADD COLUMN IF NOT EXISTS "rulesId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "findings"
      DROP COLUMN IF EXISTS "rulesId"
    `);
  }
}
