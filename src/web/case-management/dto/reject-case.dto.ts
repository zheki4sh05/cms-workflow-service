import { ApiProperty } from '@nestjs/swagger';

export class RejectCaseDto {
  @ApiProperty({
    description: 'Reason for rejecting the case',
    example: 'False positive, no risk confirmed',
  })
  comment!: string;
}
