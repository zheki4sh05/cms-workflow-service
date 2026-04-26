# Workflow Service Architecture Blueprint

## 1. Purpose

Workflow Service automates the full incident lifecycle in TrustFlow CMS:

- intake of incidents from monitoring;
- investigation orchestration;
- action plan execution control;
- SLA/deadline tracking and escalation;
- case closure and reporting.

This document defines the target architecture for further implementation in the current NestJS codebase.

## 2. Architectural Style

- **Core principle:** Clean Architecture with strict dependency rule (outer layers depend on inner layers only).
- **Domain-driven decomposition:** Case Management, Incident Management, Action Plan Management, Investigation Orchestration.
- **Integration style:** Event-driven (Kafka) + synchronous REST API.
- **Storage:** PostgreSQL for source of truth.

## 3. Layer Model

### 3.1 Domain (Business Core)

Contains enterprise rules and pure business logic.

**Entities / Aggregates**

- `Case` - root aggregate for all incident-related workflow.
- `Incident` - violation item with severity, assignee, due date, status.
- `ActionPlan` - collection of remediation tasks tied to an incident or case.
- `ActionTask` - executable unit with owner, due date, completion status.
- `Investigation` - lifecycle of analysis and verification.

**Value Objects**

- `Severity`, `IncidentStatus`, `CaseStatus`, `TaskStatus`
- `Deadline`, `Assignee`, `ResolutionEvidence`

**Domain Services**

- `CasePolicyService` - guards state transitions and closure rules.
- `IncidentPrioritizationService` - severity/SLA mapping.
- `EscalationPolicyService` - escalation decisions for overdue items.
- `ActionPlanValidationService` - verifies completeness and feasibility.

**Domain Events**

- `IncidentCreated`
- `InvestigationStarted`
- `ActionPlanVerified`
- `TaskOverdueDetected`
- `CaseClosed`

### 3.2 Application (Use Cases)

Coordinates domain logic and external dependencies via ports.

**Use Cases**

- `CreateIncidentUseCase`
- `StartInvestigationUseCase`
- `AssignIncidentOwnerUseCase`
- `CreateOrUpdateActionPlanUseCase`
- `VerifyActionPlanUseCase`
- `CloseCaseUseCase`
- `GetIncidentListUseCase`
- `GetCaseListUseCase`

**Inbound Ports**

- REST commands/queries (Web layer)
- Kafka incident intake (Infrastructure adapter)
- Scheduler triggers for SLA checks

**Outbound Ports**

- `CaseRepositoryPort`
- `IncidentRepositoryPort`
- `ActionPlanRepositoryPort`
- `DomainEventPublisherPort`
- `NotificationPort`
- `ReportPort`

**Application Services**

- command handlers;
- query handlers;
- transactional boundary orchestration;
- idempotency checks for external commands/events.

### 3.3 Infrastructure

Implements adapters for DB, messaging, scheduling, and external systems.

**Persistence**

- PostgreSQL adapters implementing repository ports.
- Recommended schema groups:
  - `cases`
  - `incidents`
  - `action_plans`
  - `action_tasks`
  - `investigations`
  - `outbox_events`

**Messaging**

- Kafka consumer for `incident_topic` (input from Monitoring Service).
- Kafka producers for domain integration events.
- Outbox pattern for reliable event publication.

**Schedulers / Background Jobs**

- overdue detection job (`TaskOverdueDetected`);
- reminder dispatch job;
- escalation job;
- periodic operational reporting job.

### 3.4 Web (Delivery Layer)

Provides API for TrustFlow-CMS frontend and operations.

**REST API groups**

- `/api/cases`
- `/api/incidents`
- `/api/action-plans`
- `/api/investigations`

**Typical operations**

- list/search cases and incidents;
- assign executors;
- start/track investigation;
- create/verify/update action plans;
- close case with resolution metadata.

## 4. Suggested Module Topology (NestJS)

```text
src/
  app/
    app.module.ts
  modules/
    case-management/
      domain/
      application/
      infrastructure/
      web/
    incident-management/
      domain/
      application/
      infrastructure/
      web/
    action-plan-management/
      domain/
      application/
      infrastructure/
      web/
    investigation-management/
      domain/
      application/
      infrastructure/
      web/
  shared/
    domain/
      events/
      value-objects/
    application/
      ports/
      bus/
    infrastructure/
      db/
      kafka/
      scheduler/
    web/
      dto/
      filters/
      guards/
```

## 5. Data and Event Flow

1. Monitoring Service publishes incident into Kafka `incident_topic`.
2. Kafka consumer adapter receives message and maps it into `CreateIncidentUseCase`.
3. Use case loads/creates a `Case`, creates `Incident`, applies policies, persists state.
4. Domain events are written to outbox in same DB transaction.
5. Outbox publisher sends integration events to Kafka for downstream services.
6. Schedulers monitor deadlines and trigger reminders/escalations.
7. Frontend queries and commands workflow state via REST API.

## 6. Cross-Cutting Requirements

- **Transactional consistency:** unit-of-work around command use cases.
- **Reliability:** outbox + retry + dead-letter strategy for Kafka.
- **Observability:** structured logging, metrics, distributed tracing.
- **Security:** JWT/OAuth2 in API gateway context, role-based authorization in use cases.
- **Auditability:** immutable audit log for status changes and assignments.
- **Validation:** DTO validation in Web layer, invariant validation in Domain layer.

## 7. Implementation Roadmap

### Phase 1 - Foundation

- initialize module topology;
- define domain models and value objects;
- introduce repository/event ports;
- implement basic REST health and case/incident read endpoints.

### Phase 2 - Core Workflow

- implement create incident, start investigation, assign owner;
- add PostgreSQL repositories;
- add Kafka incident intake consumer;
- add outbox publisher.

### Phase 3 - Action Plan and SLA

- implement action plan CRUD/verification;
- implement scheduler jobs for overdue/reminders/escalation;
- publish related domain events.

### Phase 4 - Hardening

- add integration/e2e tests for full lifecycle;
- add metrics, tracing, audit logs;
- tune retry/idempotency rules and alerting.

## 8. Definition of Done for Architecture Stage

Architecture preparation is complete when:

- all modules follow dependency rule (no infrastructure imports in domain);
- every use case has explicit inbound/outbound ports;
- event contracts are versioned and documented;
- critical workflows are covered by integration tests;
- scheduler, Kafka, and DB adapters are production-ready with observability.
