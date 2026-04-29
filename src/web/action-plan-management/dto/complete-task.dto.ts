import { ApiProperty } from '@nestjs/swagger';

export class CompleteTaskDto {
  @ApiProperty({
    description: 'Description of performed work and result',
    example: 'Что сделано и результат',
  })
  evidenceDescription!: string;
}
