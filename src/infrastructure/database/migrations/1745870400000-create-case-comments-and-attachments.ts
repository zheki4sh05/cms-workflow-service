import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCaseCommentsAndAttachments1745870400000
  implements MigrationInterface
{
  name = 'CreateCaseCommentsAndAttachments1745870400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case_comments" (
        "id" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "userId" character varying(255) NOT NULL,
        "comment" text NOT NULL,
        "time" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_case_comments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_case_comments_case_id" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case_attachments" (
        "id" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        "userId" character varying(255) NOT NULL,
        "fileId" character varying(255) NOT NULL,
        "time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "name" character varying(512) NOT NULL,
        CONSTRAINT "PK_case_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_case_attachments_case_id" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "case_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "case_comments"`);
  }
}
