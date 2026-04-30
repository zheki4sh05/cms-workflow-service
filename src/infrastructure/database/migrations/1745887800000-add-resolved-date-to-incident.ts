import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResolvedDateToIncident1745887800000
  implements MigrationInterface
{
  name = 'AddResolvedDateToIncident1745887800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incident"
      ADD COLUMN IF NOT EXISTS "resolved_date" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incident"
      DROP COLUMN IF EXISTS "resolved_date"
    `);
  }
}
