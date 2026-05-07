## Описание проекта

Микросервис `cms-workflow-service` предназначен для управления жизненным циклом инцидентов, расследований, кейсов и планов корректирующих действий в TrustFlow CMS. Сервис реализован на NestJS с разделением по принципам Clean Architecture и с предметной моделью в стиле DDD.

В корне кодовой структуры находится каталог `src`, который разделен на три основных слоя:

- `core` — бизнес-ядро;
- `infrastructure` — технические адаптеры и интеграции;
- `web` — REST API и модульная композиция приложения.

## Архитектура и модель слоев

### Модуль `core` — бизнес-ядро

Модуль `core` содержит бизнес-логику и не зависит от фреймворков хранения, транспорта и инфраструктуры.

#### `core/*/domain`

В доменном слое размещены сущности и агрегаты предметной области:

- `Incident` — инцидент комплаенс-риска со статусом, приоритетом, дедлайнами и связью с кейсом;
- `Case` (aggregate) — агрегат кейса, который управляет статусами и процессом обработки;
- `ActionPlan` — план корректирующих действий и набор задач исполнения;
- `Investigation` — сущность расследования для фиксации хода проверки;
- `OutboxMessage` — доменная модель сообщения outbox для надежной публикации событий.

#### `core/*/use-cases`

Пакеты use case реализуют прикладные сценарии и оркестрацию:

- инциденты: `IngestIncidentTopicUseCase`, `AssignIncidentToMeUseCase`, `GetIncidentListUseCase`, `GetIncidentReportUseCase`;
- кейсы: `GetCaseListUseCase`, `UpdateCaseInvestigationUseCase`, `RejectCaseUseCase`, `ReopenCaseUseCase`, операции с комментариями и вложениями;
- action plan: `CreateActionPlanUseCase`, `SubmitActionPlanUseCase`, `ApproveVerificationUseCase`, `ReturnActionPlanForRevisionUseCase`, сценарии по задачам и evidences;
- расследования: `GetInvestigationListUseCase`.

#### `core/*/ports`

Слой портов задает контракты, которые реализуются во внешних адаптерах:

- `IncidentRepository`, `CaseRepository`, `ActionPlanRepository`, `InvestigationRepository`;
- `OutboxRepository` для очереди доменных сообщений.

#### `core/*/services`

Доменные и прикладные сервисы, инкапсулирующие правила доступа и обработку:

- `IncidentResolverService` — обработка сообщений outbox по инцидентам;
- `CaseCollaborationAccessService` — правила коллаборации по кейсам;
- `ActionPlanTaskAccessService` — проверка доступа к задачам плана действий;
- `OutboxProcessorService` — фоновая обработка и ретраи outbox.

### Модуль `infrastructure` — реализация портов и интеграции

`infrastructure` реализует все зависимости от технологий:

- `persistence`-адаптеры (TypeORM ORM-entity + in-memory/postgres репозитории) для `incident`, `case`, `action-plan`, `investigation`, `outbox`;
- `database/migrations` — схема БД и эволюция структуры PostgreSQL;
- `incident-management/messaging/kafka-incident-topic.consumer.ts` — прием инцидентов из Kafka (`incident_topic`);
- `storage/minio-storage.service.ts` — работа с MinIO для вложений и evidences;
- `outbox`-адаптеры (`PostgresOutboxRepository`, `InMemoryOutboxRepository`) для надежной доставки событий.

Таким образом, технологическая реализация изолирована от бизнес-логики.

### Модуль `web` — API и композиция модулей

Слой `web` предоставляет REST-интерфейс и связывает use cases с HTTP-контрактами:

- `IncidentController` — чтение списков/статистики, отчеты, назначение инцидентов;
- `CaseController`, `CaseV1Controller` — управление кейсами, комментариями, вложениями, обновлением расследования;
- `ActionPlanController`, `TaskController`, `SupervisorVerificationController` — жизненный цикл action plan, задачи, верификация;
- `InvestigationController` — получение списка расследований.

DTO-слой (`dto`) и маппинг отделяют транспортные модели от доменных объектов.

## Реализация Clean Architecture

В проекте соблюдается разделение зависимостей:

- `domain` и `use-cases` находятся в `core` и не зависят от TypeORM, Kafka, MinIO;
- `infrastructure` зависит от `core`, реализуя порты и внешние интеграции;
- `web` зависит от `core` (use cases) и подключает инфраструктурные адаптеры через DI;
- outbox-паттерн обеспечивает надежность между транзакционной частью и асинхронной интеграцией.

## Реализация DDD

DDD в сервисе выражен через:

- агрегаты и сущности (`Case`, `Incident`, `ActionPlan`, `Investigation`);
- сценарии предметной области в use cases вместо логики в контроллерах;
- контракты репозиториев (ports), которые абстрагируют хранение;
- доменные сервисы для бизнес-правил и контроля доступа;
- outbox как механизм фиксации и публикации значимых изменений.

В результате бизнес-логика описана в терминах предметной области и изолирована от технических деталей.

## Подробная архитектурная схема

- [Architecture blueprint](./docs/architecture.md)

## Statuses

### Incident statuses

- `OPEN` - incident is created and waiting for processing.
- `PARTLY_PROGRESS` - at least one related case is still at assignment stage while others may already be in work.
- `IN_PROGRESS` - related active cases are in investigation/workflow process.
- `RESOLVED` - incident is resolved.

When incident transitions to `RESOLVED`, the `incident.resolved_date` column is set to transition timestamp.

### Case statuses

- `ASSIGNED` - case is assigned to a responsible user.
- `OPEN` - case is open.
- `INVESTIGATING` - investigation is in progress.
- `ACTION_PLAN` - action plan stage.
- `WAITING_VERIFICATION` - action plan submitted and waiting for verification.
- `ACTION_IN_PROGRESS` - verified action plan is being executed.
- `REJECTED` - case is rejected.
- `CLOSED` - case is completed and closed.

`IN_PROGRESS` is used only for `incident`, not for `case`.

### Action plan task statuses

- `TODO` - task is created and waiting to be started.
- `IN_PROGRESS` - task is in progress.
- `DONE` - task is completed.

## Kafka incident intake and outbox

- Consumer subscribes to Kafka topic `incident_topic` via Nest microservice transport.
- Incoming messages are normalized and saved into outbox with status `pending`.
- Scheduler (`@nestjs/schedule`) polls pending outbox messages for processing of `incident_topic.received`.
- Polling interval is configurable via `OUTBOX_RESOLVER_INTERVAL_MINUTES`.

Environment variables:

- `KAFKA_BROKERS` (default: `localhost:9092`)
- `KAFKA_CLIENT_ID` (default: `cms-workflow-service`)
- `KAFKA_GROUP_ID` (default: `cms-workflow-service-consumer-group`)
- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `5432`)
- `DB_USER` (default: `postgres`)
- `DB_PASSWORD` (default: `postgres`)
- `DB_NAME` (default: `cms_workflow`)
- `DB_SYNCHRONIZE` (default: `false`, set `true` only for local development)
- `OUTBOX_RESOLVER_INTERVAL_MINUTES` (default: `1`, set `10` to run every 10 minutes)
- `MINIO_ENDPOINT` (default: `localhost`)
- `MINIO_PORT` (default: `9000`)
- `MINIO_USE_SSL` (default: `false`)
- `MINIO_ACCESS_KEY` (default: `minioadmin`)
- `MINIO_SECRET_KEY` (default: `minioadmin`)
- `MINIO_BUCKET` (default: `cms-workflow-attachments`)

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## API documentation

Swagger UI is available at:

- `http://localhost:3000/api/docs`

## MinIO for attachments

Run MinIO for this service locally:

```bash
docker compose -f docker-compose.minio.yml up -d
```

MinIO endpoints:

- S3 API: `http://localhost:9000`
- Console: `http://localhost:9001`

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
