import { ApiProperty } from '@nestjs/swagger';

export class InvestigationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseId!: string;

  @ApiProperty()
  incidentId!: string;

  @ApiProperty({ enum: ['not_started', 'in_progress', 'verified', 'closed'] })
  status!: string;

  @ApiProperty({ required: false, nullable: true })
  startedAt?: Date;

  @ApiProperty({ required: false, nullable: true })
  verifiedAt?: Date;
}
