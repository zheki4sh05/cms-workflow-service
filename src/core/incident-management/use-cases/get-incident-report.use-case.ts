import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { InvestigationOrmEntity } from '../../../infrastructure/investigation-management/persistence/investigation.orm-entity';
import { CaseCommentOrmEntity } from '../../../infrastructure/case-management/persistence/case-comment.orm-entity';
import { CaseAttachmentOrmEntity } from '../../../infrastructure/case-management/persistence/case-attachment.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { VerificationOrmEntity } from '../../../infrastructure/action-plan-management/persistence/verification.orm-entity';
import { ActionPlanTaskEvidenceOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task-evidence.orm-entity';

@Injectable()
export class GetIncidentReportUseCase {
  constructor(
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(InvestigationOrmEntity)
    private readonly investigationRepository: Repository<InvestigationOrmEntity>,
    @InjectRepository(CaseCommentOrmEntity)
    private readonly caseCommentRepository: Repository<CaseCommentOrmEntity>,
    @InjectRepository(CaseAttachmentOrmEntity)
    private readonly caseAttachmentRepository: Repository<CaseAttachmentOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(VerificationOrmEntity)
    private readonly verificationRepository: Repository<VerificationOrmEntity>,
    @InjectRepository(ActionPlanTaskEvidenceOrmEntity)
    private readonly taskEvidenceRepository: Repository<ActionPlanTaskEvidenceOrmEntity>,
  ) {}

  async execute(incidentId: string) {
    const incident = await this.incidentRepository.findOne({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const findings = await this.findingRepository.find({
      where: { incidentId: incident.id },
      order: { id: 'ASC' },
    });
    const findingIds = findings.map((item) => item.id);

    const cases = findingIds.length
      ? await this.caseRepository.find({
          where: { incidentId: incident.id, findingId: In(findingIds) },
          order: { id: 'ASC' },
        })
      : [];
    const caseIds = cases.map((item) => item.id);

    const investigations = caseIds.length
      ? await this.investigationRepository.find({
          where: { caseId: In(caseIds) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const caseComments = caseIds.length
      ? await this.caseCommentRepository.find({
          where: { caseId: In(caseIds) },
          order: { time: 'ASC' },
        })
      : [];
    const caseAttachments = caseIds.length
      ? await this.caseAttachmentRepository.find({
          where: { caseId: In(caseIds) },
          order: { time: 'ASC' },
        })
      : [];
    const actionPlans = caseIds.length
      ? await this.actionPlanRepository.find({
          where: { caseId: In(caseIds) },
          order: { id: 'ASC' },
        })
      : [];
    const actionPlanIds = actionPlans.map((item) => item.id);

    const tasks = actionPlanIds.length
      ? await this.actionPlanTaskRepository.find({
          where: { actionPlanId: In(actionPlanIds) },
          order: { dueDate: 'ASC' },
        })
      : [];
    const taskIds = tasks.map((item) => item.id);

    const verifications = actionPlanIds.length
      ? await this.verificationRepository.find({
          where: { actionPlanId: In(actionPlanIds) },
          order: { id: 'ASC' },
        })
      : [];
    const taskEvidences = taskIds.length
      ? await this.taskEvidenceRepository.find({
          where: { taskId: In(taskIds) },
          order: { time: 'ASC' },
        })
      : [];

    const investigationsByCaseId = new Map(
      investigations.map((item) => [item.caseId, item]),
    );
    const commentsByCaseId = this.groupBy(caseComments, (item) => item.caseId);
    const attachmentsByCaseId = this.groupBy(
      caseAttachments,
      (item) => item.caseId,
    );
    const actionPlansByCaseId = this.groupBy(
      actionPlans,
      (item) => item.caseId,
    );
    const tasksByActionPlanId = this.groupBy(
      tasks,
      (item) => item.actionPlanId,
    );
    const verificationByActionPlanId = new Map(
      verifications.map((item) => [item.actionPlanId, item]),
    );
    const evidencesByTaskId = this.groupBy(
      taskEvidences,
      (item) => item.taskId,
    );
    const casesByFindingId = this.groupBy(cases, (item) => item.findingId);

    return {
      incident: {
        id: incident.id,
        companyId: incident.companyId,
        integrationId: incident.integrationId,
        riskObjectId: incident.riskObjectId,
        documentId: incident.documentId,
        status: incident.status,
      },
      findings: findings.map((finding) => ({
        id: finding.id,
        priority: finding.priority,
        assignedUserId: finding.assignedUserId,
        details: finding.details,
        cases: (casesByFindingId.get(finding.id) ?? []).map((currentCase) => {
          const actionPlan = (actionPlansByCaseId.get(currentCase.id) ?? [])[0];
          return {
            id: currentCase.id,
            incidentId: currentCase.incidentId,
            findingId: currentCase.findingId,
            assignedUserId: currentCase.assignedUserId,
            status: currentCase.status,
            investigation: this.mapInvestigation(
              investigationsByCaseId.get(currentCase.id),
            ),
            comments: (commentsByCaseId.get(currentCase.id) ?? []).map(
              (comment) => ({
                id: comment.id,
                userId: comment.userId,
                comment: comment.comment,
                time: comment.time,
              }),
            ),
            attachments: (attachmentsByCaseId.get(currentCase.id) ?? []).map(
              (attachment) => ({
                id: attachment.id,
                userId: attachment.userId,
                fileId: attachment.fileId,
                name: attachment.name,
                time: attachment.time,
              }),
            ),
            actionPlan: actionPlan
              ? {
                  id: actionPlan.id,
                  incidentId: actionPlan.incidentId,
                  caseId: actionPlan.caseId,
                  title: actionPlan.title,
                  description: actionPlan.description,
                  comment: actionPlan.comment,
                  verification: this.mapVerification(
                    verificationByActionPlanId.get(actionPlan.id),
                  ),
                  tasks: (tasksByActionPlanId.get(actionPlan.id) ?? []).map(
                    (task) => ({
                      id: task.id,
                      title: task.title,
                      description: task.description,
                      priority: task.priority,
                      dueDate: task.dueDate,
                      status: task.status,
                      evidenceDescriptionInprogress:
                        task.evidenceDescriptionInprogress,
                      evidenceDescriptionDone: task.evidenceDescriptionDone,
                      completedAt: task.completedAt,
                      evidences: (evidencesByTaskId.get(task.id) ?? []).map(
                        (evidence) => ({
                          id: evidence.id,
                          userId: evidence.userId,
                          fileId: evidence.fileId,
                          name: evidence.name,
                          time: evidence.time,
                        }),
                      ),
                    }),
                  ),
                }
              : null,
          };
        }),
      })),
    };
  }

  private groupBy<T, K>(items: T[], keyResolver: (item: T) => K): Map<K, T[]> {
    const grouped = new Map<K, T[]>();
    for (const item of items) {
      const key = keyResolver(item);
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
    }

    return grouped;
  }

  private mapInvestigation(investigation?: InvestigationOrmEntity) {
    if (!investigation) {
      return null;
    }

    return {
      id: investigation.id,
      caseId: investigation.caseId,
      investigationNotes: investigation.investigationNotes,
      rootCause: investigation.rootCause,
      requiresCorrectiveAction: investigation.requiresCorrectiveAction,
      createdAt: investigation.createdAt,
      updatedAt: investigation.updatedAt,
    };
  }

  private mapVerification(verification?: VerificationOrmEntity) {
    if (!verification) {
      return null;
    }

    return {
      id: verification.id,
      actionPlanId: verification.actionPlanId,
      verified: verification.verified,
      assignedUserForVerification: verification.assignedUserForVerification,
      assignedEmployeeForVerification:
        verification.assignedEmployeeForVerification,
      comments: verification.comments,
    };
  }
}
