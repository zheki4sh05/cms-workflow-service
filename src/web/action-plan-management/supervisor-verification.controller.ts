import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApproveVerificationUseCase } from '../../core/action-plan-management/use-cases/approve-verification.use-case';
import { GetPendingVerificationsListUseCase } from '../../core/action-plan-management/use-cases/get-pending-verifications-list.use-case';
import { ApproveVerificationDto } from './dto/approve-verification.dto';
import { PendingVerificationListResponseDto } from './dto/pending-verifications.dto';
import { CaseWithInvestigationResponseDto } from '../case-management/dto/case-response.dto';

@Controller('api/supervisor/verification')
export class SupervisorVerificationController {
  constructor(
    private readonly approveVerificationUseCase: ApproveVerificationUseCase,
    private readonly getPendingVerificationsListUseCase: GetPendingVerificationsListUseCase,
  ) {}

  @Get('pending')
  @ApiOperation({
    summary:
      'Планы действий, ожидающие верификации руководителем: EXECUTIVE и EXECUTOR — по компании; SUPERVISOR — где назначен как верификатор. Статус кейса WAITING_VERIFICATION, verified=false.',
  })
  @ApiOkResponse({ type: PendingVerificationListResponseDto })
  listPending(): Promise<PendingVerificationListResponseDto> {
    return this.getPendingVerificationsListUseCase.execute();
  }

  @Put(':actionPlanId')
  @ApiOperation({
    summary: 'Подтверждает верификацию плана руководителем или executive.',
  })
  @ApiBody({ type: ApproveVerificationDto, required: true })
  @ApiOkResponse({ type: CaseWithInvestigationResponseDto })
  approve(
    @Param('actionPlanId') actionPlanId: string,
    @Body() body: ApproveVerificationDto,
  ) {
    return this.approveVerificationUseCase.execute(actionPlanId, body);
  }
}
