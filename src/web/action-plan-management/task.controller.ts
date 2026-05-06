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
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetMyTasksUseCase } from '../../core/action-plan-management/use-cases/get-my-tasks.use-case';
import { GetTaskByIdUseCase } from '../../core/action-plan-management/use-cases/get-task-by-id.use-case';
import { UpdateTaskUseCase } from '../../core/action-plan-management/use-cases/update-task.use-case';
import { CompleteTaskUseCase } from '../../core/action-plan-management/use-cases/complete-task.use-case';
import { AddTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/add-task-evidence.use-case';
import { GetMyTaskStatsUseCase } from '../../core/action-plan-management/use-cases/get-my-task-stats.use-case';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import type { UploadedFile as UploadedBinaryFile } from '../../core/case-management/types/uploaded-file.type';
import {
  TaskEvidenceResponseDto,
  TaskStatsResponseDto,
  TaskResponseDto,
} from './dto/action-plan-response.dto';

@Controller('api/tasks')
export class TaskController {
  constructor(
    private readonly getMyTasksUseCase: GetMyTasksUseCase,
    private readonly getMyTaskStatsUseCase: GetMyTaskStatsUseCase,
    private readonly getTaskByIdUseCase: GetTaskByIdUseCase,
    private readonly updateTaskUseCase: UpdateTaskUseCase,
    private readonly completeTaskUseCase: CompleteTaskUseCase,
    private readonly addTaskEvidenceUseCase: AddTaskEvidenceUseCase,
  ) {}

  @Get('my')
  @ApiOperation({ summary: 'Возвращает задачи текущего пользователя.' })
  @ApiOkResponse({ type: TaskResponseDto, isArray: true })
  getMy() {
    return this.getMyTasksUseCase.execute();
  }

  @Get('my/stats')
  @ApiOperation({
    summary: 'Возвращает статистику задач текущего менеджера.',
  })
  @ApiOkResponse({ type: TaskStatsResponseDto })
  getMyStats(): Promise<TaskStatsResponseDto> {
    return this.getMyTaskStatsUseCase.execute();
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Возвращает задачу по ее идентификатору.' })
  @ApiOkResponse({ type: TaskResponseDto })
  getById(@Param('taskId') taskId: string) {
    return this.getTaskByIdUseCase.execute(taskId);
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Обновляет статус или описание прогресса задачи.' })
  @ApiBody({ type: UpdateTaskDto, required: true })
  @ApiOkResponse({ type: TaskResponseDto })
  update(@Param('taskId') taskId: string, @Body() body: UpdateTaskDto) {
    return this.updateTaskUseCase.execute(taskId, body);
  }

  @Post(':taskId/complete')
  @ApiOperation({ summary: 'Завершает задачу, фиксируя результат выполнения.' })
  @ApiBody({ type: CompleteTaskDto, required: true })
  @ApiOkResponse({ type: TaskResponseDto })
  complete(@Param('taskId') taskId: string, @Body() body: CompleteTaskDto) {
    return this.completeTaskUseCase.execute(taskId, body);
  }

  @Post(':taskId/evidence')
  @ApiOperation({ summary: 'Загружает файл-доказательство выполнения задачи.' })
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
  addEvidence(
    @Param('taskId') taskId: string,
    @UploadedFile() file?: UploadedBinaryFile,
  ) {
    return this.addTaskEvidenceUseCase.execute(taskId, { file });
  }
}
