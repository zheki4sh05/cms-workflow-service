import { ApiProperty } from '@nestjs/swagger';

export class IncidentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  integrationId!: number;

  @ApiProperty()
  riskObjectId!: string;

  @ApiProperty({ required: false, nullable: true })
  riskObjectName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  documentId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  integrationName!: string | null;

  @ApiProperty()
  status!: string;
}

export class MyIncidentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  riskObjectId!: string;

  @ApiProperty()
  riskObjectName!: string;

  @ApiProperty()
  incidentDescription!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ required: false, nullable: true })
  categoryId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  categoryName!: string | null;

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  severity!: 'low' | 'medium' | 'high';

  @ApiProperty({
    description: 'Дата первого обнаруженного правила в формате ISO',
    required: false,
    nullable: true,
  })
  detectedAt!: string | null;

  @ApiProperty({
    description: 'Дата закрытия инцидента в формате ISO',
    required: false,
    nullable: true,
  })
  resolved_date!: string | null;

  @ApiProperty({
    description:
      'Идентификаторы назначенных пользователей (assignedUserId) из findings этого инцидента',
    type: [String],
  })
  employees!: string[];
}

export class IncidentStatsByCategoryDto {
  @ApiProperty()
  categoryId!: string | null;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty()
  incidentCount!: number;
}

export class IncidentManagerStatsResponseDto {
  @ApiProperty()
  totalIncidents!: number;

  @ApiProperty()
  totalFindings!: number;

  @ApiProperty()
  totalCases!: number;

  @ApiProperty()
  new!: number;

  @ApiProperty()
  assigned!: number;

  @ApiProperty()
  inReview!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { low: 2, medium: 4, high: 2 },
  })
  bySeverity!: {
    low: number;
    medium: number;
    high: number;
  };

  @ApiProperty({ type: IncidentStatsByCategoryDto, isArray: true })
  byCategory!: IncidentStatsByCategoryDto[];

  @ApiProperty({
    description: 'Среднее время решения инцидентов в часах',
    example: 36,
  })
  avgResolutionTime!: number;

  @ApiProperty({
    description: 'Количество инцидентов с наивысшей важностью',
    example: 4,
  })
  criticalIncidents!: number;

  @ApiProperty({
    description:
      'Количество планов действий, где есть хотя бы одна просроченная задача',
    example: 2,
  })
  overdueActionPlans!: number;

  @ApiProperty({
    description:
      'Количество планов действий, которые еще не проверены руководителем',
    example: 3,
  })
  pendingVerifications!: number;
}

export class InvestigationReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty()
  investigationNotes!: string;

  @ApiProperty()
  rootCause!: string;

  @ApiProperty()
  requiresCorrectiveAction!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CaseCommentReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ required: false, nullable: true })
  firstName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastName!: string | null;

  @ApiProperty()
  comment!: string;

  @ApiProperty()
  time!: Date;
}

export class CaseAttachmentReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ required: false, nullable: true })
  firstName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastName!: string | null;

  @ApiProperty()
  fileId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Размер файла в байтах' })
  size!: number;

  @ApiProperty()
  time!: Date;
}

export class TaskEvidenceReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  fileId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  time!: Date;
}

export class ActionPlanTaskReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  priority!: string;

  @ApiProperty()
  dueDate!: Date;

  @ApiProperty({ enum: ['TODO', 'IN_PROGRESS', 'DONE'] })
  status!: string;

  @ApiProperty({ required: false, nullable: true })
  evidenceDescriptionInprogress!: string | null;

  @ApiProperty({ required: false, nullable: true })
  evidenceDescriptionDone!: string | null;

  @ApiProperty({ required: false, nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: TaskEvidenceReportDto, isArray: true })
  evidences!: TaskEvidenceReportDto[];
}

export class VerificationReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  actionPlanId!: string;

  @ApiProperty()
  verified!: boolean;

  @ApiProperty()
  assignedUserForVerification!: string;

  @ApiProperty()
  assignedEmployeeForVerification!: string;

  @ApiProperty({ required: false, nullable: true })
  comments!: string | null;
}

export class ActionPlanReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  incidentId!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty({ required: false, nullable: true })
  title!: string | null;

  @ApiProperty({ required: false, nullable: true })
  description!: string | null;

  @ApiProperty({ required: false, nullable: true })
  comment!: string | null;

  @ApiProperty({ type: VerificationReportDto, required: false, nullable: true })
  verification!: VerificationReportDto | null;

  @ApiProperty({ type: ActionPlanTaskReportDto, isArray: true })
  tasks!: ActionPlanTaskReportDto[];
}

export class CaseReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  incidentId!: string;

  @ApiProperty()
  findingId!: string;

  @ApiProperty({ required: false, nullable: true })
  assignedUserId!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty({
    type: InvestigationReportDto,
    required: false,
    nullable: true,
  })
  investigation!: InvestigationReportDto | null;

  @ApiProperty({ type: CaseCommentReportDto, isArray: true })
  comments!: CaseCommentReportDto[];

  @ApiProperty({ type: CaseAttachmentReportDto, isArray: true })
  attachments!: CaseAttachmentReportDto[];

  @ApiProperty({ type: ActionPlanReportDto, required: false, nullable: true })
  actionPlan!: ActionPlanReportDto | null;
}

export class FindingReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  priority!: string;

  @ApiProperty({ required: false, nullable: true })
  assignedUserId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  ruleName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  firstName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastName!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty({ type: CaseReportDto, isArray: true })
  cases!: CaseReportDto[];
}

export class IncidentReportResponseDto {
  @ApiProperty({ type: IncidentResponseDto })
  incident!: IncidentResponseDto;

  @ApiProperty({ type: FindingReportDto, isArray: true })
  findings!: FindingReportDto[];
}

export class ProblemAreasGroupDto {
  @ApiProperty({ description: 'Идентификатор документа интеграции' })
  documentId!: string;

  @ApiProperty({
    description:
      'Сколько инцидентов у этого документа попало в месяц (больше одного — проблемная зона)',
  })
  incidentCount!: number;

  @ApiProperty({
    type: IncidentReportResponseDto,
    isArray: true,
    description: 'Полный отчёт по каждому инциденту (как GET .../report)',
  })
  incidents!: IncidentReportResponseDto[];
}

export class ProblemAreasResponseDto {
  @ApiProperty({
    description: 'Календарный месяц в формате YYYY-MM (UTC)',
    example: '2026-05',
  })
  month!: string;

  @ApiProperty({ type: ProblemAreasGroupDto, isArray: true })
  groups!: ProblemAreasGroupDto[];
}

export class OperationsOverviewIncidentsDto {
  @ApiProperty() total!: number;
  @ApiProperty() open!: number;
  @ApiProperty() partlyProgress!: number;
  @ApiProperty() inProgress!: number;
  @ApiProperty() resolved!: number;
  @ApiProperty({ description: 'Инциденты с непустым documentId' })
  linkedToDocument!: number;
  @ApiProperty({ description: 'Без привязки к документу' })
  withoutDocument!: number;

  @ApiProperty({
    description:
      'Не в статусе RESOLVED и минимальная дата обнаружения (findings) старше 14 суток',
  })
  staleUnresolved!: number;
}

export class OperationsOverviewFindingsDto {
  @ApiProperty() total!: number;
  @ApiProperty({
    description: 'Findings без assignedUserId',
  })
  unassigned!: number;
}

export class OperationsOverviewCasesDto {
  @ApiProperty() total!: number;
  @ApiProperty() waitingVerification!: number;
  @ApiProperty() closed!: number;
  @ApiProperty({
    description: 'Прочие статусы кейсов (total − closed − waitingVerification)',
  })
  other!: number;
}

export class OperationsOverviewActionPlansDto {
  @ApiProperty({
    description:
      'Число планов действий, у которых есть просроченная незавершённая задача',
  })
  withOverdueTasks!: number;
}

export class RiskHotspotItemDto {
  @ApiProperty() riskObjectId!: string;
  @ApiProperty({ required: false, nullable: true })
  riskObjectName!: string | null;
  @ApiProperty() incidentCount!: number;
}

export class IncidentsByRiskObjectSeverityDto {
  @ApiProperty({ description: 'По полю severity объекта риска из CMS_MONITORING' })
  low!: number;

  @ApiProperty() medium!: number;
  @ApiProperty() high!: number;

  @ApiProperty({ description: 'Нет данных или не low/medium/high' })
  unknown!: number;
}

export class RuleEffectivenessItemDto {
  @ApiProperty()
  ruleId!: string;

  @ApiProperty()
  ruleName!: string;

  @ApiProperty({ required: false, nullable: true })
  categoryId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  categoryName!: string | null;

  @ApiProperty({
    description: 'Кейсы в статусе REJECTED для данного ruleId (по finding)',
  })
  rejectedCount!: number;

  @ApiProperty({
    description: 'Кейсы в статусе CLOSED для данного ruleId (по finding)',
  })
  closedCount!: number;

  @ApiProperty({
    description: 'Поле enabled из CMS Risk GET /api/internal/rules/{id}',
  })
  ruleActive!: boolean;
}

export class RuleEffectivenessResponseDto {
  @ApiProperty({ type: RuleEffectivenessItemDto, isArray: true })
  items!: RuleEffectivenessItemDto[];
}

export class OperationsOverviewResponseDto {
  @ApiProperty({ enum: ['COMPANY', 'DEPARTMENT'] })
  scope!: 'COMPANY' | 'DEPARTMENT';

  @ApiProperty({ type: OperationsOverviewIncidentsDto })
  incidents!: OperationsOverviewIncidentsDto;

  @ApiProperty({ type: OperationsOverviewFindingsDto })
  findings!: OperationsOverviewFindingsDto;

  @ApiProperty({ type: OperationsOverviewCasesDto })
  cases!: OperationsOverviewCasesDto;

  @ApiProperty({ type: OperationsOverviewActionPlansDto })
  actionPlans!: OperationsOverviewActionPlansDto;

  @ApiProperty({ type: RiskHotspotItemDto, isArray: true })
  riskHotspots!: RiskHotspotItemDto[];

  @ApiProperty({ type: IncidentsByRiskObjectSeverityDto })
  incidentsByRiskObjectSeverity!: IncidentsByRiskObjectSeverityDto;
}

export class FindingViewResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  priority!: string;

  @ApiProperty({ required: false, nullable: true })
  assignedUserId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  rulesId!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  detectedAt!: Date | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty()
  incidentId!: string;
}

export class IncidentViewResponseDto {
  @ApiProperty({ type: FindingViewResponseDto, isArray: true })
  findings!: FindingViewResponseDto[];

  @ApiProperty({ required: false, nullable: true })
  documentId!: string | null;

  @ApiProperty()
  integrationId!: number;

  @ApiProperty({ required: false, nullable: true })
  integrationName!: string | null;
}

export class AssignIncidentCaseResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  incidentId!: string;

  @ApiProperty()
  findingId!: string;

  @ApiProperty({ required: false, nullable: true })
  assignedUserId!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty({
    type: InvestigationReportDto,
    required: false,
    nullable: true,
  })
  investigation!: InvestigationReportDto | null;
}

export class IncidentReportListItemDto {
  @ApiProperty({ type: IncidentResponseDto })
  incident!: IncidentResponseDto;

  @ApiProperty({ type: FindingReportDto, isArray: true })
  findings!: FindingReportDto[];
}

export class ManagerKpiItemDto {
  @ApiProperty({ description: 'Идентификатор пользователя (менеджера)' })
  managerId!: string;

  @ApiProperty({
    description: 'Отображаемое имя менеджера',
    example: 'Иван Иванов',
  })
  managerName!: string;

  @ApiProperty({
    description:
      'Число инцидентов с назначением на менеджера (cases или findings)',
  })
  assignedIncidents!: number;

  @ApiProperty({ description: 'Число решённых инцидентов среди назначенных' })
  resolvedIncidents!: number;

  @ApiProperty({ description: 'Число активных случаев (case не в статусе CLOSED)' })
  activeCases!: number;

  @ApiProperty({ description: 'Число завершённых случаев (case в статусе CLOSED)' })
  completedCases!: number;

  @ApiProperty({
    description: 'Среднее время решения инцидента в часах (по решённым в области KPI)',
    example: 28,
  })
  avgResolutionTime!: number;

  @ApiProperty({
    description:
      'Доля задач плана действий со статусом DONE, завершённых не позже dueDate (процент)',
    example: 94,
  })
  onTimeCompletion!: number;
}

export class ManagerKpiListResponseDto {
  @ApiProperty({ type: ManagerKpiItemDto, isArray: true })
  items!: ManagerKpiItemDto[];
}

export class IncidentReportListResponseDto {
  @ApiProperty({ type: IncidentReportListItemDto, isArray: true })
  items!: IncidentReportListItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
