import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSizeToCaseAttachments1746200000000 implements MigrationInterface {
  name = 'AddSizeToCaseAttachments1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case_attachments"
      ADD COLUMN IF NOT EXISTS "size" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "case_attachments" DROP COLUMN IF EXISTS "size"
    `);
  }
}
