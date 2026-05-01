import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { GetMyIncidentListUseCase } from '../../core/incident-management/use-cases/get-my-incident-list.use-case';
import { GetIncidentReportUseCase } from '../../core/incident-management/use-cases/get-incident-report.use-case';
import { AssignIncidentToMeUseCase } from '../../core/incident-management/use-cases/assign-incident-to-me.use-case';
import { GetIncidentViewUseCase } from '../../core/incident-management/use-cases/get-incident-view.use-case';
import {
  IncidentReportResponseDto,
  IncidentViewResponseDto,
  MyIncidentResponseDto,
} from './dto/incident-response.dto';

@Controller('api/incidents')
export class IncidentController {
  constructor(
    private readonly getMyIncidentListUseCase: GetMyIncidentListUseCase,
    private readonly getIncidentReportUseCase: GetIncidentReportUseCase,
    private readonly assignIncidentToMeUseCase: AssignIncidentToMeUseCase,
    private readonly getIncidentViewUseCase: GetIncidentViewUseCase,
  ) {}

  @Get('my')
  @ApiOperation({
    summary: 'Возвращает инциденты, доступные текущему пользователю.',
  })
  @ApiOkResponse({ type: MyIncidentResponseDto, isArray: true })
  findMy(): Promise<MyIncidentResponseDto[]> {
    return this.getMyIncidentListUseCase.execute();
  }

  @Get(':incidentId/report')
  @ApiOperation({
    summary: 'Возвращает полный отчет по инциденту и связанным сущностям.',
  })
  @ApiOkResponse({ type: IncidentReportResponseDto })
  getReport(@Param('incidentId') incidentId: string) {
    return this.getIncidentReportUseCase.execute(incidentId);
  }

  @Get(':incidentId/view')
  @ApiOperation({
    summary:
      'Возвращает краткое представление инцидента: findings, documentId и данные интеграции.',
  })
  @ApiOkResponse({ type: IncidentViewResponseDto })
  getView(@Param('incidentId') incidentId: string) {
    return this.getIncidentViewUseCase.execute(incidentId);
  }

  @Post(':incidentId/assign-to-me')
  assignToMe(@Param('incidentId') incidentId: string) {
    return this.assignIncidentToMeUseCase.execute(incidentId);
  }
}
