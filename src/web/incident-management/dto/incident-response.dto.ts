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
  documentId!: string | null;

  @ApiProperty()
  status!: string;
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

  @ApiProperty({ type: InvestigationReportDto, required: false, nullable: true })
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
