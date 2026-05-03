import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetCaseListUseCase } from '../../core/case-management/use-cases/get-case-list.use-case';
import { RejectCaseUseCase } from '../../core/case-management/use-cases/reject-case.use-case';
import { ReopenCaseUseCase } from '../../core/case-management/use-cases/reopen-case.use-case';
import { AddCaseCommentUseCase } from '../../core/case-management/use-cases/add-case-comment.use-case';
import { AddCaseAttachmentUseCase } from '../../core/case-management/use-cases/add-case-attachment.use-case';
import { GetCaseCommentsUseCase } from '../../core/case-management/use-cases/get-case-comments.use-case';
import { GetCaseAttachmentsUseCase } from '../../core/case-management/use-cases/get-case-attachments.use-case';
import { DownloadCaseAttachmentUseCase } from '../../core/case-management/use-cases/download-case-attachment.use-case';
import { DeleteCaseAttachmentUseCase } from '../../core/case-management/use-cases/delete-case-attachment.use-case';
import { UpdateCaseInvestigationUseCase } from '../../core/case-management/use-cases/update-case-investigation.use-case';
import { GetMyCaseListUseCase } from '../../core/case-management/use-cases/get-my-case-list.use-case';
import { GetCaseViewListUseCase } from '../../core/case-management/use-cases/get-case-view-list.use-case';
import { CASE_REPOSITORY } from '../../core/case-management/ports/case.repository.port';
import { InMemoryCaseRepository } from '../../infrastructure/case-management/persistence/in-memory-case.repository';
import { CaseController } from './case.controller';
import { CaseV1Controller } from './case-v1.controller';
import { CaseOrmEntity } from '../../infrastructure/case-management/persistence/case.orm-entity';
import { IncidentOrmEntity } from '../../infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../infrastructure/incident-management/persistence/finding.orm-entity';
import { ActionPlanOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { CaseCommentOrmEntity } from '../../infrastructure/case-management/persistence/case-comment.orm-entity';
import { CaseAttachmentOrmEntity } from '../../infrastructure/case-management/persistence/case-attachment.orm-entity';
import { InvestigationOrmEntity } from '../../infrastructure/investigation-management/persistence/investigation.orm-entity';
import { CaseCollaborationAccessService } from '../../core/case-management/services/case-collaboration-access.service';
import { MinioStorageService } from '../../infrastructure/storage/minio-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CaseOrmEntity,
      IncidentOrmEntity,
      FindingOrmEntity,
      ActionPlanOrmEntity,
      CaseCommentOrmEntity,
      CaseAttachmentOrmEntity,
      InvestigationOrmEntity,
    ]),
  ],
  controllers: [CaseController, CaseV1Controller],
  providers: [
    GetCaseListUseCase,
    RejectCaseUseCase,
    ReopenCaseUseCase,
    AddCaseCommentUseCase,
    GetCaseCommentsUseCase,
    AddCaseAttachmentUseCase,
    GetCaseAttachmentsUseCase,
    DownloadCaseAttachmentUseCase,
    DeleteCaseAttachmentUseCase,
    UpdateCaseInvestigationUseCase,
    GetMyCaseListUseCase,
    GetCaseViewListUseCase,
    CaseCollaborationAccessService,
    MinioStorageService,
    InMemoryCaseRepository,
    {
      provide: CASE_REPOSITORY,
      useExisting: InMemoryCaseRepository,
    },
  ],
  exports: [
    GetCaseListUseCase,
    CaseCollaborationAccessService,
    MinioStorageService,
  ],
})
export class CaseManagementModule {}
