import {
  Body,
  Controller,
  Get,
  Param,
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
import { memoryStorage } from 'multer';
import { GetMyCaseListUseCase } from '../../core/case-management/use-cases/get-my-case-list.use-case';
import { MyCaseListItemResponseDto } from './dto/my-case-list-item-response.dto';
import { GetCaseViewListUseCase } from '../../core/case-management/use-cases/get-case-view-list.use-case';
import { CaseViewListItemResponseDto } from './dto/case-view-list-item-response.dto';
import { AddCaseCommentUseCase } from '../../core/case-management/use-cases/add-case-comment.use-case';
import { AddCaseAttachmentUseCase } from '../../core/case-management/use-cases/add-case-attachment.use-case';
import { CreateCaseCommentDto } from './dto/create-case-comment.dto';
import type { UploadedFile as UploadedBinaryFile } from '../../core/case-management/types/uploaded-file.type';
import {
  CaseAttachmentResponseDto,
  CaseCommentResponseDto,
} from './dto/case-response.dto';

@Controller('api/v1/cases')
export class CaseV1Controller {
  constructor(
    private readonly getMyCaseListUseCase: GetMyCaseListUseCase,
    private readonly getCaseViewListUseCase: GetCaseViewListUseCase,
    private readonly addCaseCommentUseCase: AddCaseCommentUseCase,
    private readonly addCaseAttachmentUseCase: AddCaseAttachmentUseCase,
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

  @Post(':caseId/comments')
  @ApiOperation({ summary: 'Добавляет новый комментарий к выбранному case.' })
  @ApiBody({ type: CreateCaseCommentDto, required: true })
  @ApiCreatedResponse({ type: CaseCommentResponseDto })
  addComment(
    @Param('caseId') caseId: string,
    @Body() body: CreateCaseCommentDto,
  ) {
    return this.addCaseCommentUseCase.execute(caseId, body);
  }

  @Post(':caseId/attachments')
  @ApiOperation({ summary: 'Загружает файл-вложение для выбранного case.' })
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  @ApiCreatedResponse({ type: CaseAttachmentResponseDto })
  addAttachment(
    @Param('caseId') caseId: string,
    @UploadedFile() file?: UploadedBinaryFile,
  ) {
    return this.addCaseAttachmentUseCase.execute(caseId, { file });
  }
}
