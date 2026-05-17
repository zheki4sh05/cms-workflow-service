import {
  Body,
  Controller,
  Delete,
  Header,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetActionPlanListUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-list.use-case';
import { CreateActionPlanUseCase } from '../../core/action-plan-management/use-cases/create-action-plan.use-case';
import { CreateActionPlanDto } from './dto/create-action-plan.dto';
import { UpdateActionPlanDto } from './dto/update-action-plan.dto';
import { SubmitActionPlanUseCase } from '../../core/action-plan-management/use-cases/submit-action-plan.use-case';
import { UpdateActionPlanUseCase } from '../../core/action-plan-management/use-cases/update-action-plan.use-case';
import { ApproveVerificationUseCase } from '../../core/action-plan-management/use-cases/approve-verification.use-case';
import { ReturnActionPlanForRevisionUseCase } from '../../core/action-plan-management/use-cases/return-action-plan-for-revision.use-case';
import { AddActionPlanTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/add-action-plan-task-evidence.use-case';
import { GetActionPlanTaskEvidencesUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-task-evidences.use-case';
import { DownloadActionPlanTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/download-action-plan-task-evidence.use-case';
import { DeleteActionPlanTaskUseCase } from '../../core/action-plan-management/use-cases/delete-action-plan-task.use-case';
import type { UploadedFile as UploadedBinaryFile } from '../../core/case-management/types/uploaded-file.type';
import { ConfirmActionPlanDto } from './dto/confirm-action-plan.dto';
import { ReturnActionPlanForRevisionDto } from './dto/return-action-plan-for-revision.dto';
import {
  ActionPlanListItemDto,
  CreateActionPlanResponseDto,
  TaskEvidenceResponseDto,
  UpdateActionPlanResponseDto,
} from './dto/action-plan-response.dto';
import { CaseWithInvestigationResponseDto } from '../case-management/dto/case-response.dto';

@Controller('api/action-plans')
export class ActionPlanController {
  constructor(
    private readonly getActionPlanListUseCase: GetActionPlanListUseCase,
    private readonly createActionPlanUseCase: CreateActionPlanUseCase,
    private readonly updateActionPlanUseCase: UpdateActionPlanUseCase,
    private readonly submitActionPlanUseCase: SubmitActionPlanUseCase,
    private readonly approveVerificationUseCase: ApproveVerificationUseCase,
    private readonly returnActionPlanForRevisionUseCase: ReturnActionPlanForRevisionUseCase,
    private readonly addActionPlanTaskEvidenceUseCase: AddActionPlanTaskEvidenceUseCase,
    private readonly getActionPlanTaskEvidencesUseCase: GetActionPlanTaskEvidencesUseCase,
    private readonly downloadActionPlanTaskEvidenceUseCase: DownloadActionPlanTaskEvidenceUseCase,
    private readonly deleteActionPlanTaskUseCase: DeleteActionPlanTaskUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Для роли MANAGER: планы действий по кейсам, где пользователь ответственный (assignedUserId). Иначе пустой список.',
  })
  @ApiOkResponse({ type: ActionPlanListItemDto, isArray: true })
  findAll() {
    return this.getActionPlanListUseCase.execute();
  }

  @Post()
  @ApiOperation({
    summary:
      'Создаёт или обновляет план для case (один план на case): при уже существующем плане обновляются title/description и добавляются переданные задачи.',
  })
  @ApiBody({ type: CreateActionPlanDto, required: true })
  @ApiCreatedResponse({ type: CreateActionPlanResponseDto })
  create(@Body() body: CreateActionPlanDto) {
    return this.createActionPlanUseCase.execute(body);
  }

  @Patch(':planId')
  @ApiOperation({
    summary:
      'Обновляет поля плана (title, description, comment). Роль MANAGER и доступ к кейсу по правилам коллаборации.',
  })
  @ApiBody({ type: UpdateActionPlanDto, required: true })
  @ApiOkResponse({ type: UpdateActionPlanResponseDto })
  update(
    @Param('planId') planId: string,
    @Body() body: UpdateActionPlanDto,
  ) {
    return this.updateActionPlanUseCase.execute(planId, body);
  }

  @Post(':planId/submit')
  @ApiOperation({
    summary:
      'Отправляет план на верификацию и переводит case в ожидание проверки.',
  })
  @ApiOkResponse({ type: CaseWithInvestigationResponseDto })
  submit(@Param('planId') planId: string) {
    return this.submitActionPlanUseCase.execute(planId);
  }

  @Post(':planId/confirm')
  @ApiOperation({
    summary: 'Подтверждает план действий (SUPERVISOR/EXECUTIVE).',
  })
  @ApiBody({ type: ConfirmActionPlanDto, required: true })
  @ApiOkResponse({ type: CaseWithInvestigationResponseDto })
  confirm(
    @Param('planId') planId: string,
    @Body() body: ConfirmActionPlanDto,
  ) {
    const comments = body.comments ?? body.comment;
    return this.approveVerificationUseCase.execute(planId, {
      approved: true,
      comments,
    });
  }

  @Post(':planId/return-for-revision')
  @ApiOperation({
    summary: 'Отправляет план действий на доработку (SUPERVISOR/EXECUTIVE).',
  })
  @ApiBody({ type: ReturnActionPlanForRevisionDto, required: true })
  @ApiOkResponse({ type: CaseWithInvestigationResponseDto })
  returnForRevision(
    @Param('planId') planId: string,
    @Body() body: ReturnActionPlanForRevisionDto,
  ) {
    return this.returnActionPlanForRevisionUseCase.execute(planId, {
      comments: body.comments ?? body.comment,
    });
  }

  @Delete(':actionPlanId/tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Удаляет задачу из плана действий. Доступ: ответственный по кейсу (assignedUserId) или руководитель отдела.',
  })
  @ApiNoContentResponse({ description: 'Задача удалена' })
  async deleteTask(
    @Param('actionPlanId') actionPlanId: string,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    await this.deleteActionPlanTaskUseCase.execute(actionPlanId, taskId);
  }

  @Post(':actionPlanId/tasks/:taskId/evidences')
  @ApiOperation({
    summary: 'Загружает файл-доказательство для задачи плана действий.',
  })
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
  @ApiOperation({
    summary: 'Возвращает список файлов-доказательств задачи плана.',
  })
  @ApiOkResponse({ type: TaskEvidenceResponseDto, isArray: true })
  getTaskEvidences(
    @Param('actionPlanId') actionPlanId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.getActionPlanTaskEvidencesUseCase.execute(actionPlanId, taskId);
  }

  @Get(':actionPlanId/tasks/:taskId/evidences/:evidenceId/download')
  @ApiOperation({
    summary: 'Скачивает конкретный файл-доказательство по идентификатору.',
  })
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
