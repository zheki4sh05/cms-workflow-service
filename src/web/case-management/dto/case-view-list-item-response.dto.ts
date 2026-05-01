import { ApiProperty } from '@nestjs/swagger';

export class CaseViewListItemResponseDto {
  @ApiProperty({ required: false, nullable: true })
  ruleId!: string | null;

  @ApiProperty({ required: false, nullable: true })
  ruleName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  ruleCondition!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty({ required: false, nullable: true })
  investigationNotes!: string | null;

  @ApiProperty({ required: false, nullable: true })
  rootCause!: string | null;

  @ApiProperty({ required: false, nullable: true })
  requiresCorrectiveAction!: boolean | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  updatedAt!: Date | null;
}
