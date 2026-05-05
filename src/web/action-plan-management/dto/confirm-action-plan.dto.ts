import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmActionPlanDto {
  @ApiProperty({
    description: 'Supervisor or executive comments for action plan confirmation',
    example: 'План подтвержден, можно запускать в работу',
  })
  comments?: string;

  @ApiPropertyOptional({
    description: 'Backward-compatible alias for comments',
    example: 'План подтвержден, можно запускать в работу',
  })
  comment?: string;
}
