import { ApiProperty } from '@nestjs/swagger';

export class ActionTaskListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ required: false, nullable: true })
  assigneeId?: string;

  @ApiProperty({ enum: ['todo', 'in_progress', 'done', 'overdue'] })
  status!: string;

  @ApiProperty({ required: false, nullable: true })
  dueAt?: Date;
}

export class UpdateActionPlanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty()
  incidentId!: string;

  @ApiProperty({ required: false, nullable: true })
  title!: string | null;

  @ApiProperty({ required: false, nullable: true })
  description!: string | null;

  @ApiProperty({ required: false, nullable: true })
  comment!: string | null;

  @ApiProperty({
    description: 'Показывать ли задачи этого плана в API задач',
    example: false,
  })
  showTasks!: boolean;
}

export class ActionPlanListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty({
    description: 'Текущий status связанной сущности case',
    example: 'ACTION_PLAN',
  })
  caseStatus!: string;

  @ApiProperty({
    description:
      'Наименование рискового объекта из CMS Monitoring (incident → riskObjectId)',
    required: false,
    nullable: true,
  })
  riskObjectName!: string | null;

  @ApiProperty({
    description: 'Поле details из связанной записи findings (jsonb)',
    required: false,
    nullable: true,
    type: Object,
    example: {},
  })
  details!: Record<string, unknown> | null;

  @ApiProperty({ required: false, nullable: true })
  incidentId?: string;

  @ApiProperty({ required: false, nullable: true })
  title!: string | null;

  @ApiProperty({ required: false, nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'Показывать ли задачи этого плана в API задач',
    example: false,
  })
  showTasks!: boolean;

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

  @ApiProperty({
    description: 'Показывать ли задачи этого плана в API задач',
    example: false,
  })
  showTasks!: boolean;

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

  @ApiProperty({ required: false, nullable: true })
  incidentId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  documentId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  incidentStatus!: string | null;

  @ApiProperty({ required: false, nullable: true })
  comment!: string | null;

  @ApiProperty({ required: false, nullable: true })
  actionPlanTitle!: string | null;

  @ApiProperty({ required: false, nullable: true })
  actionPlanDescription!: string | null;

  @ApiProperty({ required: false, nullable: true })
  actionPlanComment!: string | null;

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

export class TaskStatsResponseDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  todo!: number;

  @ApiProperty()
  inProgress!: number;

  @ApiProperty()
  done!: number;

  @ApiProperty()
  overdue!: number;

  @ApiProperty()
  dueToday!: number;

  @ApiProperty({ type: [String] })
  dueTodayIds!: string[];

  @ApiProperty()
  dueTomorrow!: number;

  @ApiProperty({ type: [String] })
  dueTomorrowIds!: string[];
}
