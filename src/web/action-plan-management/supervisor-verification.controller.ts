import { Body, Controller, Param, Put } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { ApproveVerificationUseCase } from '../../core/action-plan-management/use-cases/approve-verification.use-case';
import { ApproveVerificationDto } from './dto/approve-verification.dto';

@Controller('api/supervisor/verification')
export class SupervisorVerificationController {
  constructor(private readonly approveVerificationUseCase: ApproveVerificationUseCase) {}

  @Put(':actionPlanId')
  @ApiBody({ type: ApproveVerificationDto, required: true })
  approve(
    @Param('actionPlanId') actionPlanId: string,
    @Body() body: ApproveVerificationDto,
  ) {
    return this.approveVerificationUseCase.execute(actionPlanId, body);
  }
}
