import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepartmentIdToIncident1746710000000
  implements MigrationInterface
{
  name = 'AddDepartmentIdToIncident1746710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incident"
      ADD COLUMN IF NOT EXISTS "departmentId" character varying(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incident"
      DROP COLUMN IF EXISTS "departmentId"
    `);
  }
}
