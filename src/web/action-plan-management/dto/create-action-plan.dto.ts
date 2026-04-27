import { ApiProperty } from '@nestjs/swagger';
import { ActionPlanTaskPriority } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';

export class CreateActionPlanTaskDto {
  @ApiProperty({ example: 'Пересмотреть регламент' })
  title!: string;

  @ApiProperty({ example: 'Что нужно сделать' })
  description!: string;

  @ApiProperty({ example: 'NORMAL' })
  priority!: ActionPlanTaskPriority;

  @ApiProperty({ example: '2026-05-05T00:00:00.000Z' })
  dueDate!: string;
}

export class CreateActionPlanDto {
  @ApiProperty({ example: 'caseId' })
  caseId!: string;

  @ApiProperty({ example: 'План корректирующих действий для случая CS-2024-004' })
  title!: string;

  @ApiProperty({ example: 'Краткое описание плана/основание' })
  description!: string;

  @ApiProperty({ type: [CreateActionPlanTaskDto] })
  tasks!: CreateActionPlanTaskDto[];
}
