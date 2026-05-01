import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { GetMyCaseListUseCase } from '../../core/case-management/use-cases/get-my-case-list.use-case';
import { MyCaseListItemResponseDto } from './dto/my-case-list-item-response.dto';
import { GetCaseViewListUseCase } from '../../core/case-management/use-cases/get-case-view-list.use-case';
import { CaseViewListItemResponseDto } from './dto/case-view-list-item-response.dto';

@Controller('api/v1/cases')
export class CaseV1Controller {
  constructor(
    private readonly getMyCaseListUseCase: GetMyCaseListUseCase,
    private readonly getCaseViewListUseCase: GetCaseViewListUseCase,
  ) {}

  @Get('my')
  @ApiOperation({
    summary:
      'Возвращает список case для MANAGER: ruleId, ruleName, priority, status, deadline.',
  })
  @ApiOkResponse({ type: MyCaseListItemResponseDto, isArray: true })
  findMy(): Promise<MyCaseListItemResponseDto[]> {
    return this.getMyCaseListUseCase.execute();
  }

  @Get(':caseId/view')
  @ApiOperation({
    summary:
      'Возвращает данные case по id: ruleId, ruleName, ruleCondition и details.',
  })
  @ApiOkResponse({ type: CaseViewListItemResponseDto })
  findView(@Param('caseId') caseId: string): Promise<CaseViewListItemResponseDto> {
    return this.getCaseViewListUseCase.execute(caseId);
  }
}
