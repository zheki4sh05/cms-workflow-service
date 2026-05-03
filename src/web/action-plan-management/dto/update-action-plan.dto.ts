import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateActionPlanDto {
  @ApiPropertyOptional({ example: 'План корректирующих действий' })
  title?: string;

  @ApiPropertyOptional({ example: 'Описание плана' })
  description?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Комментарий к плану; передайте null, чтобы очистить.',
  })
  comment?: string | null;
}
