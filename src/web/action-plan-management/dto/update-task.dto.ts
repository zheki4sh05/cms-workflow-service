import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskDto {
  @ApiProperty({
    required: false,
    description: 'Task status',
    example: 'IN_PROGRESS',
  })
  status?: string;

  @ApiProperty({
    required: false,
    description: 'Evidence description for task progress update',
    example: 'Начали выполнение, собраны исходные данные',
  })
  evidenceDescription?: string;
}
