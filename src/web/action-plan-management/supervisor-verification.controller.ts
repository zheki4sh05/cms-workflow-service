import { Body, Controller, Param, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApproveVerificationUseCase } from '../../core/action-plan-management/use-cases/approve-verification.use-case';
import { ApproveVerificationDto } from './dto/approve-verification.dto';
import { CaseWithInvestigationResponseDto } from '../case-management/dto/case-response.dto';

@Controller('api/supervisor/verification')
export class SupervisorVerificationController {
  constructor(
    private readonly approveVerificationUseCase: ApproveVerificationUseCase,
  ) {}

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
