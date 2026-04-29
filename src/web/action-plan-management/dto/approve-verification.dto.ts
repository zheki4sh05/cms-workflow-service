import { ApiProperty } from '@nestjs/swagger';

export class ApproveVerificationDto {
  @ApiProperty({
    description: 'Whether verification is approved',
    example: true,
  })
  approved!: boolean;

  @ApiProperty({
    description: 'Supervisor or executive comments for action plan',
    example: 'План одобрен, можно запускать в работу',
  })
  comments!: string;
}
