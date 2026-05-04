import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetIncidentListUseCase } from '../../core/incident-management/use-cases/get-incident-list.use-case';
import { IngestIncidentTopicUseCase } from '../../core/incident-management/use-cases/ingest-incident-topic.use-case';
import { GetMyIncidentListUseCase } from '../../core/incident-management/use-cases/get-my-incident-list.use-case';
import { GetIncidentReportUseCase } from '../../core/incident-management/use-cases/get-incident-report.use-case';
import { AssignIncidentToMeUseCase } from '../../core/incident-management/use-cases/assign-incident-to-me.use-case';
import { GetIncidentViewUseCase } from '../../core/incident-management/use-cases/get-incident-view.use-case';
import { GetIncidentReportListUseCase } from '../../core/incident-management/use-cases/get-incident-report-list.use-case';
import { INCIDENT_REPOSITORY } from '../../core/incident-management/ports/incident.repository.port';
import { InMemoryIncidentRepository } from '../../infrastructure/incident-management/persistence/in-memory-incident.repository';
import { IncidentController } from './incident.controller';
import { KafkaIncidentTopicConsumer } from '../../infrastructure/incident-management/messaging/kafka-incident-topic.consumer';
import { IncidentOrmEntity } from '../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../../infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../infrastructure/incident-management/persistence/finding.orm-entity';
import { InvestigationOrmEntity } from '../../infrastructure/investigation-management/persistence/investigation.orm-entity';
import { CaseCommentOrmEntity } from '../../infrastructure/case-management/persistence/case-comment.orm-entity';
import { CaseAttachmentOrmEntity } from '../../infrastructure/case-management/persistence/case-attachment.orm-entity';
import { ActionPlanOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { VerificationOrmEntity } from '../../infrastructure/action-plan-management/persistence/verification.orm-entity';
import { ActionPlanTaskEvidenceOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan-task-evidence.orm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IncidentOrmEntity,
      FindingOrmEntity,
      CaseOrmEntity,
      InvestigationOrmEntity,
      CaseCommentOrmEntity,
      CaseAttachmentOrmEntity,
      ActionPlanOrmEntity,
      ActionPlanTaskOrmEntity,
      VerificationOrmEntity,
      ActionPlanTaskEvidenceOrmEntity,
    ]),
  ],
  controllers: [IncidentController, KafkaIncidentTopicConsumer],
  providers: [
    GetIncidentListUseCase,
    GetMyIncidentListUseCase,
    GetIncidentReportUseCase,
    GetIncidentViewUseCase,
    GetIncidentReportListUseCase,
    AssignIncidentToMeUseCase,
    IngestIncidentTopicUseCase,
    InMemoryIncidentRepository,
    {
      provide: INCIDENT_REPOSITORY,
      useExisting: InMemoryIncidentRepository,
    },
  ],
})
export class IncidentManagementModule {}
