import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CaseOrmEntity } from '../../infrastructure/case-management/persistence/case.orm-entity';
import { ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GetMyIncidentListUseCase } from '../../core/incident-management/use-cases/get-my-incident-list.use-case';
import { GetIncidentReportUseCase } from '../../core/incident-management/use-cases/get-incident-report.use-case';
import { AssignIncidentToMeUseCase } from '../../core/incident-management/use-cases/assign-incident-to-me.use-case';
import { GetIncidentViewUseCase } from '../../core/incident-management/use-cases/get-incident-view.use-case';
import { GetIncidentReportListUseCase } from '../../core/incident-management/use-cases/get-incident-report-list.use-case';
import { GetMyIncidentStatsUseCase } from '../../core/incident-management/use-cases/get-my-incident-stats.use-case';
import { GetManagerKpiListUseCase } from '../../core/incident-management/use-cases/get-manager-kpi-list.use-case';
import { GetProblemAreasUseCase } from '../../core/incident-management/use-cases/get-problem-areas.use-case';
import { GetOperationsOverviewUseCase } from '../../core/incident-management/use-cases/get-operations-overview.use-case';
import {
  AssignIncidentCaseResponseDto,
  IncidentManagerStatsResponseDto,
  IncidentReportListResponseDto,
  IncidentReportResponseDto,
  IncidentViewResponseDto,
  ManagerKpiListResponseDto,
  MyIncidentResponseDto,
  ProblemAreasResponseDto,
  OperationsOverviewResponseDto,
} from './dto/incident-response.dto';

@Controller('api/incidents')
export class IncidentController {
  constructor(
    private readonly getMyIncidentListUseCase: GetMyIncidentListUseCase,
    private readonly getIncidentReportUseCase: GetIncidentReportUseCase,
    private readonly assignIncidentToMeUseCase: AssignIncidentToMeUseCase,
    private readonly getIncidentViewUseCase: GetIncidentViewUseCase,
    private readonly getIncidentReportListUseCase: GetIncidentReportListUseCase,
    private readonly getMyIncidentStatsUseCase: GetMyIncidentStatsUseCase,
    private readonly getManagerKpiListUseCase: GetManagerKpiListUseCase,
    private readonly getProblemAreasUseCase: GetProblemAreasUseCase,
    private readonly getOperationsOverviewUseCase: GetOperationsOverviewUseCase,
  ) {}

  @Get('my')
  @ApiOperation({
    summary:
      'MANAGER: инциденты по своим назначениям (cases/findings). SUPERVISOR: инциденты текущей компании, где findings или cases назначены на userIds подчинённых отдела (cms-company-info GET /employee/department-manager-subordinates; для SUPERVISOR нужен заголовок EmployeeId, если нет employeeId в профиле).',
  })
  @ApiOkResponse({ type: MyIncidentResponseDto, isArray: true })
  findMy(): Promise<MyIncidentResponseDto[]> {
    return this.getMyIncidentListUseCase.execute();
  }

  @Get('my/stats')
  @ApiOperation({
    summary:
      'Статистика по инцидентам: EXECUTIVE и EXECUTOR — по всей компании; SUPERVISOR — подчинённые отдела (нужен EmployeeId при отсутствии в профиле); MANAGER — свои назначения.',
  })
  @ApiOkResponse({ type: IncidentManagerStatsResponseDto })
  getMyStats(): Promise<IncidentManagerStatsResponseDto> {
    return this.getMyIncidentStatsUseCase.execute();
  }

  @Get('kpi/managers')
  @ApiOperation({
    summary:
      'KPI по сотрудникам (менеджерам) с назначениями: SUPERVISOR — подчинённые отдела руководителя; EXECUTIVE и EXECUTOR — все назначенные по компании. Требуется заголовок EmployeeId для SUPERVISOR, если нет employeeId в профиле.',
  })
  @ApiOkResponse({ type: ManagerKpiListResponseDto })
  getManagerKpi(): Promise<ManagerKpiListResponseDto> {
    return this.getManagerKpiListUseCase.execute();
  }

  @Get('overview')
  @ApiOperation({
    summary:
      'Операционная сводка: конвейер инцидентов и кейсов, «залипшие» нерешённые (>14 дней с первого обнаружения), топ объектов риска (мониторинг), серьёзность по объектам риска, просрочки в планах. EXECUTIVE и EXECUTOR — компания; SUPERVISOR — отдел (подчинённые).',
  })
  @ApiOkResponse({ type: OperationsOverviewResponseDto })
  getOperationsOverview(): Promise<OperationsOverviewResponseDto> {
    return this.getOperationsOverviewUseCase.execute() as Promise<OperationsOverviewResponseDto>;
  }

  @Get('reports')
  @ApiOperation({
    summary:
      'Постраничный список полных отчетов по инцидентам для ролей SUPERVISOR, EXECUTIVE и EXECUTOR (EXECUTIVE/EXECUTOR — по компании).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'incidentId', required: false, type: String })
  @ApiQuery({ name: 'documentId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiOkResponse({ type: IncidentReportListResponseDto })
  getReports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('incidentId') incidentId?: string,
    @Query('documentId') documentId?: string,
    @Query('status') status?: string,
  ): Promise<IncidentReportListResponseDto> {
    return this.getIncidentReportListUseCase.execute(
      Number(page ?? '1'),
      Number(limit ?? '10'),
      {
        incidentId,
        documentId,
        status,
      },
    ) as Promise<IncidentReportListResponseDto>;
  }

  @Get('problem-areas')
  @ApiOperation({
    summary:
      'Проблемные зоны: инциденты с одинаковым documentId, у которых за выбранный календарный месяц (UTC) более одного срабатывания. EXECUTIVE и EXECUTOR — компания; SUPERVISOR — как отчёты (подчинённые отдела). Полные отчёты как по GET /:incidentId/report.',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: String,
    example: '2026-05',
    description: 'Год-месяц UTC (YYYY-MM). По умолчанию — текущий месяц UTC.',
  })
  @ApiOkResponse({ type: ProblemAreasResponseDto })
  getProblemAreas(
    @Query('month') month?: string,
  ): Promise<ProblemAreasResponseDto> {
    return this.getProblemAreasUseCase.execute(
      month,
    ) as Promise<ProblemAreasResponseDto>;
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
  @ApiOperation({
    summary:
      'Для каждого finding инцидента: если ответственный не указан — назначается текущий пользователь; если уже вы (id/employeeId) — оставляем. На каждый такой finding создаётся отдельный case (если ещё нет). Чужие findings не трогаются.',
  })
  @ApiOkResponse({ type: AssignIncidentCaseResponseDto, isArray: true })
  async assignToMe(
    @Param('incidentId') incidentId: string,
  ): Promise<AssignIncidentCaseResponseDto[]> {
    const cases = await this.assignIncidentToMeUseCase.execute(incidentId);
    return cases.map((c) => this.mapCaseToAssignResponse(c));
  }

  private mapCaseToAssignResponse(
    currentCase: CaseOrmEntity,
  ): AssignIncidentCaseResponseDto {
    const inv = currentCase.investigation;
    return {
      id: currentCase.id,
      incidentId: currentCase.incidentId,
      findingId: currentCase.findingId,
      assignedUserId: currentCase.assignedUserId,
      status: currentCase.status,
      investigation: inv
        ? {
            id: inv.id,
            caseId: inv.caseId,
            investigationNotes: inv.investigationNotes,
            rootCause: inv.rootCause,
            requiresCorrectiveAction: inv.requiresCorrectiveAction,
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt,
          }
        : null,
    };
  }
}
