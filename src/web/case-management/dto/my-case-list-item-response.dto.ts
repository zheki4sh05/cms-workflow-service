import { ApiProperty } from '@nestjs/swagger';

export class MyCaseListItemResponseDto {
  @ApiProperty()
  caseId!: string;

  @ApiProperty({ required: false, nullable: true })
  ruleId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  ruleName!: string | null;

  @ApiProperty()
  priority!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  deadline!: Date | null;
}
