import { ApiProperty } from '@nestjs/swagger';

export class UpdateCaseInvestigationDto {
  @ApiProperty({
    description: 'Detailed notes captured during investigation',
    example: 'Проведен анализ документов и переписки с поставщиком',
  })
  investigationNotes!: string;

  @ApiProperty({
    description: 'Root cause identified during investigation',
    example: 'Отсутствие механизма фиксации цен после согласования бюджета',
  })
  rootCause!: string;

  @ApiProperty({
    description: 'Whether corrective action is required',
    example: true,
  })
  requiresCorrectiveAction!: boolean;
}
