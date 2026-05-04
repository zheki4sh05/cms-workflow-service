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
    description:
      'Идентификаторы назначенных пользователей (assignedUserId) из findings этого инцидента',
    type: [String],
  })
  employees!: string[];
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
