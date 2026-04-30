import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutboxMessagesTable1745860200000 implements MigrationInterface {
  name = 'CreateOutboxMessagesTable1745860200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_messages" (
        "id" uuid NOT NULL,
        "topic" character varying(255) NOT NULL,
        "payload" jsonb NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL,
        "status" character varying(20) NOT NULL,
        "processedAt" TIMESTAMPTZ,
        "errorMessage" text,
        CONSTRAINT "PK_outbox_messages_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_outbox_messages_status_createdAt"
      ON "outbox_messages" ("status", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_outbox_messages_status_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_messages"`);
  }
}
