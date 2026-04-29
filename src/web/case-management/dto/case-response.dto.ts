import { ApiProperty } from '@nestjs/swagger';

export class CaseListItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ['open', 'in_progress', 'closed'] })
  status!: string;

  @ApiProperty({ type: [String] })
  incidentIds!: string[];
}

export class InvestigationInCaseResponseDto {
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

export class CaseStateResponseDto {
  @ApiProperty()
  caseId!: string;

  @ApiProperty()
  caseStatus!: string;
}

export class CaseWithInvestigationResponseDto {
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

  @ApiProperty({ type: InvestigationInCaseResponseDto, required: false, nullable: true })
  investigation?: InvestigationInCaseResponseDto | null;
}

export class RejectCaseResponseDto extends CaseStateResponseDto {
  @ApiProperty()
  incidentId!: string;

  @ApiProperty()
  incidentStatus!: string;
}

export class CaseCommentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  comment!: string;

  @ApiProperty()
  time!: Date;
}

export class CaseAttachmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  fileId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  time!: Date;
}
