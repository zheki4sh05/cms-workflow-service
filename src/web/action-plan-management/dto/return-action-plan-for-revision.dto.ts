import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnActionPlanForRevisionDto {
  @ApiProperty({
    description: 'Supervisor or executive comments for rework request',
    example: 'Нужно уточнить сроки и добавить риски по задаче #2',
  })
  comments?: string;

  @ApiPropertyOptional({
    description: 'Backward-compatible alias for comments',
    example: 'Нужно уточнить сроки и добавить риски по задаче #2',
  })
  comment?: string;
}
