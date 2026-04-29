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
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetActionPlanListUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-list.use-case';
import { CreateActionPlanUseCase } from '../../core/action-plan-management/use-cases/create-action-plan.use-case';
import { CreateActionPlanDto } from './dto/create-action-plan.dto';
import { SubmitActionPlanUseCase } from '../../core/action-plan-management/use-cases/submit-action-plan.use-case';
import { AddActionPlanTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/add-action-plan-task-evidence.use-case';
import { GetActionPlanTaskEvidencesUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-task-evidences.use-case';
import { DownloadActionPlanTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/download-action-plan-task-evidence.use-case';
import type { UploadedFile as UploadedBinaryFile } from '../../core/case-management/types/uploaded-file.type';

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
  findAll() {
    return this.getActionPlanListUseCase.execute();
  }

  @Post()
  @ApiBody({ type: CreateActionPlanDto, required: true })
  create(@Body() body: CreateActionPlanDto) {
    return this.createActionPlanUseCase.execute(body);
  }

  @Post(':planId/submit')
  submit(@Param('planId') planId: string) {
    return this.submitActionPlanUseCase.execute(planId);
  }

  @Post(':actionPlanId/tasks/:taskId/evidences')
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
  getTaskEvidences(
    @Param('actionPlanId') actionPlanId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.getActionPlanTaskEvidencesUseCase.execute(actionPlanId, taskId);
  }

  @Get(':actionPlanId/tasks/:taskId/evidences/:evidenceId/download')
  @Header('Cache-Control', 'no-store')
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
