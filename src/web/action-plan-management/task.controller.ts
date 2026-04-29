import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetMyTasksUseCase } from '../../core/action-plan-management/use-cases/get-my-tasks.use-case';
import { GetTaskByIdUseCase } from '../../core/action-plan-management/use-cases/get-task-by-id.use-case';
import { UpdateTaskUseCase } from '../../core/action-plan-management/use-cases/update-task.use-case';
import { CompleteTaskUseCase } from '../../core/action-plan-management/use-cases/complete-task.use-case';
import { AddTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/add-task-evidence.use-case';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import type { UploadedFile as UploadedBinaryFile } from '../../core/case-management/types/uploaded-file.type';

@Controller('api/tasks')
export class TaskController {
  constructor(
    private readonly getMyTasksUseCase: GetMyTasksUseCase,
    private readonly getTaskByIdUseCase: GetTaskByIdUseCase,
    private readonly updateTaskUseCase: UpdateTaskUseCase,
    private readonly completeTaskUseCase: CompleteTaskUseCase,
    private readonly addTaskEvidenceUseCase: AddTaskEvidenceUseCase,
  ) {}

  @Get('my')
  getMy() {
    return this.getMyTasksUseCase.execute();
  }

  @Get(':taskId')
  getById(@Param('taskId') taskId: string) {
    return this.getTaskByIdUseCase.execute(taskId);
  }

  @Patch(':taskId')
  @ApiBody({ type: UpdateTaskDto, required: true })
  update(@Param('taskId') taskId: string, @Body() body: UpdateTaskDto) {
    return this.updateTaskUseCase.execute(taskId, body);
  }

  @Post(':taskId/complete')
  @ApiBody({ type: CompleteTaskDto, required: true })
  complete(@Param('taskId') taskId: string, @Body() body: CompleteTaskDto) {
    return this.completeTaskUseCase.execute(taskId, body);
  }

  @Post(':taskId/evidence')
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
  addEvidence(@Param('taskId') taskId: string, @UploadedFile() file?: UploadedBinaryFile) {
    return this.addTaskEvidenceUseCase.execute(taskId, { file });
  }
}
