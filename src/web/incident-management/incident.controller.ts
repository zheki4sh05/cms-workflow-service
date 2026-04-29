import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { GetMyIncidentListUseCase } from '../../core/incident-management/use-cases/get-my-incident-list.use-case';
import { GetIncidentReportUseCase } from '../../core/incident-management/use-cases/get-incident-report.use-case';
import {
  IncidentReportResponseDto,
  IncidentResponseDto,
} from './dto/incident-response.dto';

@Controller('api/incidents')
export class IncidentController {
  constructor(
    private readonly getMyIncidentListUseCase: GetMyIncidentListUseCase,
    private readonly getIncidentReportUseCase: GetIncidentReportUseCase,
  ) {}

  @Get('my')
  @ApiOperation({ summary: 'Возвращает инциденты, доступные текущему пользователю.' })
  @ApiOkResponse({ type: IncidentResponseDto, isArray: true })
  findMy() {
    return this.getMyIncidentListUseCase.execute();
  }

  @Get(':incidentId/report')
  @ApiOperation({ summary: 'Возвращает полный отчет по инциденту и связанным сущностям.' })
  @ApiOkResponse({ type: IncidentReportResponseDto })
  getReport(@Param('incidentId') incidentId: string) {
    return this.getIncidentReportUseCase.execute(incidentId);
  }

}
