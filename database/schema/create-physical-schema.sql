-- =============================================================================
-- cms-workflow-service — физическая схема PostgreSQL (итоговое состояние)
-- =============================================================================
--
-- Сгенерировано по миграциям TypeORM: src/infrastructure/database/migrations/
-- Не заменяет миграции приложения; используется для:
--   - развёртывания БД «с нуля» вне TypeORM;
--   - локальной подготовки пустой схемы;
--   - ревью и документирования физической модели.
--
-- Запуск (пример):
--   psql -h localhost -U postgres -d cms_workflow -f database/schema/create-physical-schema.sql
--
-- Перед повторным запуском скрипт удаляет все таблицы сервиса (DROP … CASCADE).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Удаление объектов (обратный порядок зависимостей)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "action_plan_task_evidences" CASCADE;
DROP TABLE IF EXISTS "verifications" CASCADE;
DROP TABLE IF EXISTS "action_plan_tasks" CASCADE;
DROP TABLE IF EXISTS "action_plans" CASCADE;
DROP TABLE IF EXISTS "investigations" CASCADE;
DROP TABLE IF EXISTS "case_attachments" CASCADE;
DROP TABLE IF EXISTS "case_comments" CASCADE;
DROP TABLE IF EXISTS "cases" CASCADE;
DROP TABLE IF EXISTS "findings" CASCADE;
DROP TABLE IF EXISTS "incident" CASCADE;
DROP TABLE IF EXISTS "outbox_messages" CASCADE;

-- ---------------------------------------------------------------------------
-- outbox_messages (Transactional Outbox, без FK на домен)
-- ---------------------------------------------------------------------------

CREATE TABLE "outbox_messages" (
  "id" uuid NOT NULL,
  "topic" character varying(255) NOT NULL,
  "payload" jsonb NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "status" character varying(20) NOT NULL,
  "processedAt" TIMESTAMPTZ,
  "errorMessage" text,
  CONSTRAINT "PK_outbox_messages_id" PRIMARY KEY ("id")
);

CREATE INDEX "IDX_outbox_messages_status_createdAt"
  ON "outbox_messages" ("status", "createdAt");

-- ---------------------------------------------------------------------------
-- incident
-- ---------------------------------------------------------------------------

CREATE TABLE "incident" (
  "id" uuid NOT NULL,
  "companyId" character varying(255) NOT NULL,
  "integrationId" integer NOT NULL,
  "riskObjectId" character varying(255) NOT NULL,
  "departmentId" character varying(255),
  "documentId" character varying(255),
  "status" character varying(20) NOT NULL,
  "resolved_date" TIMESTAMP,
  CONSTRAINT "PK_incident_id" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- findings
-- ---------------------------------------------------------------------------

CREATE TABLE "findings" (
  "id" uuid NOT NULL,
  "priority" character varying(50) NOT NULL,
  "assignedUserId" character varying(255),
  "rulesId" uuid,
  "detectedAt" TIMESTAMPTZ,
  "deadline" TIMESTAMPTZ,
  "details" jsonb NOT NULL,
  "incidentId" uuid NOT NULL,
  CONSTRAINT "PK_findings_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_findings_incident_id"
    FOREIGN KEY ("incidentId") REFERENCES "incident" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------

CREATE TABLE "cases" (
  "id" uuid NOT NULL,
  "incidentId" uuid NOT NULL,
  "findingId" uuid NOT NULL,
  "assignedUserId" character varying(255),
  "status" character varying(20) NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "PK_cases_id" PRIMARY KEY ("id"),
  CONSTRAINT "uq_cases_incident_assignee"
    UNIQUE ("incidentId", "findingId", "assignedUserId"),
  CONSTRAINT "FK_cases_incident_id"
    FOREIGN KEY ("incidentId") REFERENCES "incident" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_cases_finding_id"
    FOREIGN KEY ("findingId") REFERENCES "findings" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ---------------------------------------------------------------------------
-- investigations
-- ---------------------------------------------------------------------------

CREATE TABLE "investigations" (
  "id" uuid NOT NULL,
  "caseId" uuid NOT NULL,
  "investigationNotes" text NOT NULL,
  "rootCause" text NOT NULL,
  "requiresCorrectiveAction" boolean NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_investigations_id" PRIMARY KEY ("id"),
  CONSTRAINT "uq_investigations_case_id" UNIQUE ("caseId"),
  CONSTRAINT "FK_investigations_case_id"
    FOREIGN KEY ("caseId") REFERENCES "cases" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ---------------------------------------------------------------------------
-- case_comments, case_attachments
-- ---------------------------------------------------------------------------

CREATE TABLE "case_comments" (
  "id" uuid NOT NULL,
  "caseId" uuid NOT NULL,
  "userId" character varying(255) NOT NULL,
  "comment" text NOT NULL,
  "time" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "PK_case_comments_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_case_comments_case_id"
    FOREIGN KEY ("caseId") REFERENCES "cases" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "case_attachments" (
  "id" uuid NOT NULL,
  "caseId" uuid NOT NULL,
  "userId" character varying(255) NOT NULL,
  "fileId" character varying(255) NOT NULL,
  "time" TIMESTAMPTZ NOT NULL,
  "name" character varying(512) NOT NULL,
  "size" integer NOT NULL DEFAULT 0,
  CONSTRAINT "PK_case_attachments_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_case_attachments_case_id"
    FOREIGN KEY ("caseId") REFERENCES "cases" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ---------------------------------------------------------------------------
-- action_plans, action_plan_tasks, action_plan_task_evidences, verifications
-- ---------------------------------------------------------------------------

CREATE TABLE "action_plans" (
  "id" uuid NOT NULL,
  "caseId" uuid NOT NULL,
  "incidentId" uuid NOT NULL,
  "title" character varying(500),
  "description" text,
  "comment" text,
  "showTasks" boolean NOT NULL DEFAULT false,
  CONSTRAINT "PK_action_plans_id" PRIMARY KEY ("id"),
  CONSTRAINT "uq_action_plans_case_id" UNIQUE ("caseId"),
  CONSTRAINT "FK_action_plans_case_id"
    FOREIGN KEY ("caseId") REFERENCES "cases" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_action_plans_incident_id"
    FOREIGN KEY ("incidentId") REFERENCES "incident" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "action_plan_tasks" (
  "id" uuid NOT NULL,
  "actionPlanId" uuid NOT NULL,
  "title" character varying(255) NOT NULL,
  "description" text NOT NULL,
  "priority" character varying(20) NOT NULL,
  "dueDate" TIMESTAMPTZ NOT NULL,
  "status" character varying(20) NOT NULL DEFAULT 'TODO',
  "evidenceDescriptionInprogress" text,
  "evidenceDescriptionDone" text,
  "completedAt" TIMESTAMPTZ,
  CONSTRAINT "PK_action_plan_tasks_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_action_plan_tasks_action_plan_id"
    FOREIGN KEY ("actionPlanId") REFERENCES "action_plans" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "CHK_action_plan_tasks_status"
    CHECK ("status" IN ('TODO', 'IN_PROGRESS', 'DONE'))
);

CREATE TABLE "action_plan_task_evidences" (
  "id" uuid NOT NULL,
  "taskId" uuid NOT NULL,
  "userId" character varying(255) NOT NULL,
  "fileId" uuid NOT NULL,
  "name" character varying(500) NOT NULL,
  "time" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "PK_action_plan_task_evidences_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_action_plan_task_evidences_task_id"
    FOREIGN KEY ("taskId") REFERENCES "action_plan_tasks" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "verifications" (
  "id" uuid NOT NULL,
  "actionPlanId" uuid NOT NULL,
  "verified" boolean NOT NULL DEFAULT false,
  "assignedUserForVerification" character varying(255) NOT NULL,
  "assignedEmployeeForVerification" character varying(255) NOT NULL,
  "comments" text,
  CONSTRAINT "PK_verifications_id" PRIMARY KEY ("id"),
  CONSTRAINT "uq_verifications_action_plan_id" UNIQUE ("actionPlanId"),
  CONSTRAINT "FK_verifications_action_plan_id"
    FOREIGN KEY ("actionPlanId") REFERENCES "action_plans" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ---------------------------------------------------------------------------
-- Описания таблиц и атрибутов (COMMENT ON — видны в pg_catalog и \d+)
-- ---------------------------------------------------------------------------

COMMENT ON TABLE "outbox_messages" IS
  'Transactional Outbox: очередь асинхронной обработки событий (Kafka → домен).';

COMMENT ON COLUMN "outbox_messages"."id" IS 'PK. UUID сообщения.';
COMMENT ON COLUMN "outbox_messages"."topic" IS 'Логический тип события для маршрутизации обработчика (напр. incident_topic.received).';
COMMENT ON COLUMN "outbox_messages"."payload" IS 'JSON-тело события для обработки.';
COMMENT ON COLUMN "outbox_messages"."createdAt" IS 'Время постановки записи в outbox.';
COMMENT ON COLUMN "outbox_messages"."status" IS 'Статус обработки: pending | processed | failed.';
COMMENT ON COLUMN "outbox_messages"."processedAt" IS 'Время завершения обработки (успех или финальная ошибка).';
COMMENT ON COLUMN "outbox_messages"."errorMessage" IS 'Текст ошибки при status = failed.';

COMMENT ON TABLE "incident" IS
  'Инцидент комплаенс-риска: агрегат по объекту риска и событию мониторинга.';

COMMENT ON COLUMN "incident"."id" IS 'PK. UUID инцидента.';
COMMENT ON COLUMN "incident"."companyId" IS 'Идентификатор компании (tenant).';
COMMENT ON COLUMN "incident"."integrationId" IS 'ID интеграции мониторинга, источник события.';
COMMENT ON COLUMN "incident"."riskObjectId" IS 'ID объекта риска (monitoring-сервис).';
COMMENT ON COLUMN "incident"."departmentId" IS 'ID подразделения объекта риска; заполняется при обогащении из monitoring.';
COMMENT ON COLUMN "incident"."documentId" IS 'Опциональный ID связанного документа из события.';
COMMENT ON COLUMN "incident"."status" IS 'Статус инцидента: OPEN | PARTLY_PROGRESS | IN_PROGRESS | RESOLVED.';
COMMENT ON COLUMN "incident"."resolved_date" IS 'Момент перехода в RESOLVED (без timezone, TIMESTAMP).';

COMMENT ON TABLE "findings" IS
  'Находка (срабатывание правила) внутри инцидента.';

COMMENT ON COLUMN "findings"."id" IS 'PK. UUID находки.';
COMMENT ON COLUMN "findings"."priority" IS 'Приоритет срабатывания (из rulePriority Kafka-события).';
COMMENT ON COLUMN "findings"."assignedUserId" IS 'Предлагаемый ответственный (responsible_user_id из события).';
COMMENT ON COLUMN "findings"."rulesId" IS 'UUID правила в risk-сервисе.';
COMMENT ON COLUMN "findings"."detectedAt" IS 'Время обнаружения нарушения.';
COMMENT ON COLUMN "findings"."deadline" IS 'Крайний срок обработки находки.';
COMMENT ON COLUMN "findings"."details" IS 'JSONB: result, found, details и прочие поля срабатывания.';
COMMENT ON COLUMN "findings"."incidentId" IS 'FK → incident.id. Родительский инцидент.';

COMMENT ON TABLE "cases" IS
  'Кейс: работа исполнителя по одной находке в рамках инцидента.';

COMMENT ON COLUMN "cases"."id" IS 'PK. UUID кейса.';
COMMENT ON COLUMN "cases"."incidentId" IS 'FK → incident.id.';
COMMENT ON COLUMN "cases"."findingId" IS 'FK → findings.id. Находка, по которой ведётся кейс.';
COMMENT ON COLUMN "cases"."assignedUserId" IS 'Назначенный исполнитель; часть уникального ключа с incidentId и findingId.';
COMMENT ON COLUMN "cases"."status" IS 'Этап workflow: ASSIGNED, OPEN, INVESTIGATING, ACTION_PLAN, WAITING_VERIFICATION, ACTION_IN_PROGRESS, REJECTED, CLOSED и др.';

COMMENT ON TABLE "investigations" IS
  'Расследование по кейсу (материалы, причина, необходимость корректирующих действий).';

COMMENT ON COLUMN "investigations"."id" IS 'PK. UUID расследования.';
COMMENT ON COLUMN "investigations"."caseId" IS 'FK → cases.id. Уникально: один кейс — не более одного расследования.';
COMMENT ON COLUMN "investigations"."investigationNotes" IS 'Заметки и ход расследования.';
COMMENT ON COLUMN "investigations"."rootCause" IS 'Установленная первопричина.';
COMMENT ON COLUMN "investigations"."requiresCorrectiveAction" IS 'true — требуется план корректирующих действий.';
COMMENT ON COLUMN "investigations"."createdAt" IS 'Время создания записи.';
COMMENT ON COLUMN "investigations"."updatedAt" IS 'Время последнего обновления (авто TypeORM).';

COMMENT ON TABLE "case_comments" IS
  'Комментарий участника в обсуждении кейса.';

COMMENT ON COLUMN "case_comments"."id" IS 'PK. UUID комментария.';
COMMENT ON COLUMN "case_comments"."caseId" IS 'FK → cases.id.';
COMMENT ON COLUMN "case_comments"."userId" IS 'ID автора (CMS Auth).';
COMMENT ON COLUMN "case_comments"."comment" IS 'Текст комментария.';
COMMENT ON COLUMN "case_comments"."time" IS 'Время публикации.';

COMMENT ON TABLE "case_attachments" IS
  'Метаданные вложения к кейсу; файл в MinIO.';

COMMENT ON COLUMN "case_attachments"."id" IS 'PK. UUID записи вложения.';
COMMENT ON COLUMN "case_attachments"."caseId" IS 'FK → cases.id.';
COMMENT ON COLUMN "case_attachments"."userId" IS 'ID пользователя, загрузившего файл.';
COMMENT ON COLUMN "case_attachments"."fileId" IS 'Ключ/ID объекта в MinIO (S3).';
COMMENT ON COLUMN "case_attachments"."time" IS 'Время загрузки.';
COMMENT ON COLUMN "case_attachments"."name" IS 'Исходное имя файла.';
COMMENT ON COLUMN "case_attachments"."size" IS 'Размер файла в байтах.';

COMMENT ON TABLE "action_plans" IS
  'План корректирующих действий по кейсу.';

COMMENT ON COLUMN "action_plans"."id" IS 'PK. UUID плана.';
COMMENT ON COLUMN "action_plans"."caseId" IS 'FK → cases.id. Уникально: один план на кейс.';
COMMENT ON COLUMN "action_plans"."incidentId" IS 'FK → incident.id. Денормализация для выборок по инциденту.';
COMMENT ON COLUMN "action_plans"."title" IS 'Заголовок плана.';
COMMENT ON COLUMN "action_plans"."description" IS 'Описание плана и мер.';
COMMENT ON COLUMN "action_plans"."comment" IS 'Комментарий при отправке/согласовании.';
COMMENT ON COLUMN "action_plans"."showTasks" IS 'Показывать ли задачи исполнителям (видимость списка задач).';

COMMENT ON TABLE "action_plan_tasks" IS
  'Задача в плане корректирующих действий.';

COMMENT ON COLUMN "action_plan_tasks"."id" IS 'PK. UUID задачи.';
COMMENT ON COLUMN "action_plan_tasks"."actionPlanId" IS 'FK → action_plans.id.';
COMMENT ON COLUMN "action_plan_tasks"."title" IS 'Название задачи.';
COMMENT ON COLUMN "action_plan_tasks"."description" IS 'Описание и ожидаемый результат.';
COMMENT ON COLUMN "action_plan_tasks"."priority" IS 'Приоритет: LOW | NORMAL | HIGH | CRITICAL.';
COMMENT ON COLUMN "action_plan_tasks"."dueDate" IS 'Срок исполнения.';
COMMENT ON COLUMN "action_plan_tasks"."status" IS 'Статус: TODO | IN_PROGRESS | DONE (CHECK constraint).';
COMMENT ON COLUMN "action_plan_tasks"."evidenceDescriptionInprogress" IS 'Требования к доказательствам на этапе IN_PROGRESS.';
COMMENT ON COLUMN "action_plan_tasks"."evidenceDescriptionDone" IS 'Требования к доказательствам при завершении (DONE).';
COMMENT ON COLUMN "action_plan_tasks"."completedAt" IS 'Фактическое время завершения задачи.';

COMMENT ON TABLE "action_plan_task_evidences" IS
  'Файл-доказательство по задаче плана; объект в MinIO.';

COMMENT ON COLUMN "action_plan_task_evidences"."id" IS 'PK. UUID записи доказательства.';
COMMENT ON COLUMN "action_plan_task_evidences"."taskId" IS 'FK → action_plan_tasks.id.';
COMMENT ON COLUMN "action_plan_task_evidences"."userId" IS 'ID пользователя, прикрепившего файл.';
COMMENT ON COLUMN "action_plan_task_evidences"."fileId" IS 'UUID объекта в MinIO.';
COMMENT ON COLUMN "action_plan_task_evidences"."name" IS 'Имя файла.';
COMMENT ON COLUMN "action_plan_task_evidences"."time" IS 'Время прикрепления.';

COMMENT ON TABLE "verifications" IS
  'Верификация (приёмка) плана супервайзером.';

COMMENT ON COLUMN "verifications"."id" IS 'PK. UUID верификации.';
COMMENT ON COLUMN "verifications"."actionPlanId" IS 'FK → action_plans.id. Уникально: одна верификация на план.';
COMMENT ON COLUMN "verifications"."verified" IS 'true — план принят; false — отклонён или ожидает решения.';
COMMENT ON COLUMN "verifications"."assignedUserForVerification" IS 'ID пользователя-верификатора (Auth).';
COMMENT ON COLUMN "verifications"."assignedEmployeeForVerification" IS 'ID сотрудника-верификатора (company-info).';
COMMENT ON COLUMN "verifications"."comments" IS 'Комментарий супервайзера при приёмке/возврате.';

COMMIT;
