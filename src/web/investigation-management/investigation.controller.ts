import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { GetInvestigationListUseCase } from '../../core/investigation-management/use-cases/get-investigation-list.use-case';
import { InvestigationResponseDto } from './dto/investigation-response.dto';

@Controller('api/investigations')
export class InvestigationController {
  constructor(
    private readonly getInvestigationListUseCase: GetInvestigationListUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Возвращает список расследований.' })
  @ApiOkResponse({ type: InvestigationResponseDto, isArray: true })
  findAll() {
    return this.getInvestigationListUseCase.execute();
  }
}
