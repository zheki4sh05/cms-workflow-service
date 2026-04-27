import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIncidentCaseFindingTables1745751900000
  implements MigrationInterface
{
  name = 'CreateIncidentCaseFindingTables1745751900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incident" (
        "id" uuid NOT NULL,
        "companyId" character varying(255) NOT NULL,
        "integrationId" integer NOT NULL,
        "riskObjectId" character varying(255) NOT NULL,
        "documentId" character varying(255),
        "status" character varying(20) NOT NULL,
        CONSTRAINT "PK_incident_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cases" (
        "id" uuid NOT NULL,
        "incidentId" uuid NOT NULL,
        "responsibleUserId" character varying(255),
        "status" character varying(20) NOT NULL,
        CONSTRAINT "PK_cases_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_cases_incident_assignee" UNIQUE ("incidentId", "responsibleUserId"),
        CONSTRAINT "FK_cases_incident_id" FOREIGN KEY ("incidentId") REFERENCES "incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "findings" (
        "id" uuid NOT NULL,
        "priority" character varying(50) NOT NULL,
        "assignedUserId" character varying(255),
        "details" jsonb NOT NULL,
        "incidentId" uuid NOT NULL,
        "caseId" uuid NOT NULL,
        CONSTRAINT "PK_findings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_findings_incident_id" FOREIGN KEY ("incidentId") REFERENCES "incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "findings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incident"`);
  }
}
