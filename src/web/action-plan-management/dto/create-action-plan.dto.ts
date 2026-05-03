import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActionPlanTaskDto {
  @ApiProperty({ example: 'Пересмотреть регламент' })
  title!: string;

  @ApiProperty({ example: 'Что нужно сделать' })
  description!: string;

  @ApiProperty({ example: 'NORMAL' })
  priority!: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

  @ApiProperty({ example: '2026-05-05T00:00:00.000Z' })
  dueDate!: string;
}

export class CreateActionPlanDto {
  @ApiProperty({ example: 'caseId' })
  caseId!: string;

  @ApiProperty({
    example: 'План корректирующих действий для случая CS-2024-004',
  })
  title!: string;

  @ApiProperty({ example: 'Краткое описание плана/основание' })
  description!: string;

  @ApiPropertyOptional({
    type: [CreateActionPlanTaskDto],
    description:
      'Задачи плана (массив объектов). Можно передать строку с JSON-массивом того же вида. При повторном запросе для того же case план обновляется, новые задачи добавляются к существующим.',
  })
  tasks?: CreateActionPlanTaskDto[] | string;
}
