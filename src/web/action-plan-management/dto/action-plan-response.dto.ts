import { ApiProperty } from '@nestjs/swagger';

export class ActionTaskListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  assigneeId?: string;

  @ApiProperty({ enum: ['todo', 'in_progress', 'done', 'overdue'] })
  status!: string;

  @ApiProperty({ required: false, nullable: true })
  dueAt?: Date;
}

export class ActionPlanListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty({ required: false, nullable: true })
  incidentId?: string;

  @ApiProperty({ type: ActionTaskListItemDto, isArray: true })
  tasks!: ActionTaskListItemDto[];
}

export class CreateActionPlanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty()
  caseStatus!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: () => TaskResponseDto, isArray: true })
  tasks!: TaskResponseDto[];
}

export class TaskEvidenceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  taskId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  fileId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  time!: Date;

  @ApiProperty({ required: false })
  actionPlanId?: string;
}

export class TaskResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  actionPlanId!: string;

  @ApiProperty({ required: false, nullable: true })
  caseId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  caseStatus!: string | null;

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
}
