import { ApiProperty } from '@nestjs/swagger';

export class PendingVerificationResponsibleDto {
  @ApiProperty({ nullable: true })
  userId!: string | null;

  @ApiProperty({ nullable: true })
  employeeId!: string | null;

  @ApiProperty({ nullable: true })
  firstName!: string | null;

  @ApiProperty({ nullable: true })
  lastName!: string | null;
}

export class PendingVerificationItemDto {
  @ApiProperty({
    description: 'Идентификатор плана действий, ждущего верификации',
  })
  actionPlanId!: string;

  @ApiProperty({
    description: 'Идентификатор инцидента',
  })
  incidentId!: string;

  @ApiProperty({
    nullable: true,
    description:
      'Заголовок документа из details findings (интеграция), при отсутствии — null',
  })
  documentTitle!: string | null;

  @ApiProperty({ type: PendingVerificationResponsibleDto })
  responsible!: PendingVerificationResponsibleDto;

  @ApiProperty({
    nullable: true,
    description:
      'Момент поступления инцидента (ранняя дата обнаружения по findings), ISO-8601',
  })
  incidentReceivedAt!: string | null;
}

export class PendingVerificationListResponseDto {
  @ApiProperty({ type: PendingVerificationItemDto, isArray: true })
  items!: PendingVerificationItemDto[];
}
