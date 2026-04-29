import {
  Body,
  Controller,
  Header,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetActionPlanListUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-list.use-case';
import { CreateActionPlanUseCase } from '../../core/action-plan-management/use-cases/create-action-plan.use-case';
import { CreateActionPlanDto } from './dto/create-action-plan.dto';
import { SubmitActionPlanUseCase } from '../../core/action-plan-management/use-cases/submit-action-plan.use-case';
import { AddActionPlanTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/add-action-plan-task-evidence.use-case';
import { GetActionPlanTaskEvidencesUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-task-evidences.use-case';
import { DownloadActionPlanTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/download-action-plan-task-evidence.use-case';
import type { UploadedFile as UploadedBinaryFile } from '../../core/case-management/types/uploaded-file.type';
import {
  ActionPlanListItemDto,
  CreateActionPlanResponseDto,
  TaskEvidenceResponseDto,
} from './dto/action-plan-response.dto';
import { CaseWithInvestigationResponseDto } from '../case-management/dto/case-response.dto';

@Controller('api/action-plans')
export class ActionPlanController {
  constructor(
    private readonly getActionPlanListUseCase: GetActionPlanListUseCase,
    private readonly createActionPlanUseCase: CreateActionPlanUseCase,
    private readonly submitActionPlanUseCase: SubmitActionPlanUseCase,
    private readonly addActionPlanTaskEvidenceUseCase: AddActionPlanTaskEvidenceUseCase,
    private readonly getActionPlanTaskEvidencesUseCase: GetActionPlanTaskEvidencesUseCase,
    private readonly downloadActionPlanTaskEvidenceUseCase: DownloadActionPlanTaskEvidenceUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Возвращает список всех планов действий.' })
  @ApiOkResponse({ type: ActionPlanListItemDto, isArray: true })
  findAll() {
    return this.getActionPlanListUseCase.execute();
  }

  @Post()
  @ApiOperation({ summary: 'Создает план действий и задачи для выбранного case.' })
  @ApiBody({ type: CreateActionPlanDto, required: true })
  @ApiCreatedResponse({ type: CreateActionPlanResponseDto })
  create(@Body() body: CreateActionPlanDto) {
    return this.createActionPlanUseCase.execute(body);
  }

  @Post(':planId/submit')
  @ApiOperation({ summary: 'Отправляет план на верификацию и переводит case в ожидание проверки.' })
  @ApiOkResponse({ type: CaseWithInvestigationResponseDto })
  submit(@Param('planId') planId: string) {
    return this.submitActionPlanUseCase.execute(planId);
  }

  @Post(':actionPlanId/tasks/:taskId/evidences')
  @ApiOperation({ summary: 'Загружает файл-доказательство для задачи плана действий.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiCreatedResponse({ type: TaskEvidenceResponseDto })
  addTaskEvidence(
    @Param('actionPlanId') actionPlanId: string,
    @Param('taskId') taskId: string,
    @UploadedFile() file?: UploadedBinaryFile,
  ) {
    return this.addActionPlanTaskEvidenceUseCase.execute(actionPlanId, taskId, {
      file,
    });
  }

  @Get(':actionPlanId/tasks/:taskId/evidences')
  @ApiOperation({ summary: 'Возвращает список файлов-доказательств задачи плана.' })
  @ApiOkResponse({ type: TaskEvidenceResponseDto, isArray: true })
  getTaskEvidences(
    @Param('actionPlanId') actionPlanId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.getActionPlanTaskEvidencesUseCase.execute(actionPlanId, taskId);
  }

  @Get(':actionPlanId/tasks/:taskId/evidences/:evidenceId/download')
  @ApiOperation({ summary: 'Скачивает конкретный файл-доказательство по идентификатору.' })
  @Header('Cache-Control', 'no-store')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    schema: { type: 'string', format: 'binary' },
  })
  async downloadTaskEvidence(
    @Param('actionPlanId') actionPlanId: string,
    @Param('taskId') taskId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    const file = await this.downloadActionPlanTaskEvidenceUseCase.execute(
      actionPlanId,
      taskId,
      evidenceId,
    );

    return new StreamableFile(file.stream, {
      type: file.contentType,
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }
}
