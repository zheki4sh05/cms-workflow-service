import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Post,
  Put,
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
  ApiResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GetCaseListUseCase } from '../../core/case-management/use-cases/get-case-list.use-case';
import { RejectCaseUseCase } from '../../core/case-management/use-cases/reject-case.use-case';
import { RejectCaseDto } from './dto/reject-case.dto';
import { ReopenCaseUseCase } from '../../core/case-management/use-cases/reopen-case.use-case';
import { AddCaseCommentUseCase } from '../../core/case-management/use-cases/add-case-comment.use-case';
import { CreateCaseCommentDto } from './dto/create-case-comment.dto';
import { AddCaseAttachmentUseCase } from '../../core/case-management/use-cases/add-case-attachment.use-case';
import { GetCaseCommentsUseCase } from '../../core/case-management/use-cases/get-case-comments.use-case';
import { GetCaseAttachmentsUseCase } from '../../core/case-management/use-cases/get-case-attachments.use-case';
import { DownloadCaseAttachmentUseCase } from '../../core/case-management/use-cases/download-case-attachment.use-case';
import { DeleteCaseAttachmentUseCase } from '../../core/case-management/use-cases/delete-case-attachment.use-case';
import type { UploadedFile as UploadedBinaryFile } from '../../core/case-management/types/uploaded-file.type';
import { UpdateCaseInvestigationUseCase } from '../../core/case-management/use-cases/update-case-investigation.use-case';
import { UpdateCaseInvestigationDto } from './dto/update-case-investigation.dto';
import {
  CaseAttachmentResponseDto,
  CaseListItemResponseDto,
  CaseCommentResponseDto,
  CaseStateResponseDto,
  CaseWithInvestigationResponseDto,
  RejectCaseResponseDto,
} from './dto/case-response.dto';

@Controller('api/cases')
export class CaseController {
  constructor(
    private readonly getCaseListUseCase: GetCaseListUseCase,
    private readonly rejectCaseUseCase: RejectCaseUseCase,
    private readonly reopenCaseUseCase: ReopenCaseUseCase,
    private readonly addCaseCommentUseCase: AddCaseCommentUseCase,
    private readonly getCaseCommentsUseCase: GetCaseCommentsUseCase,
    private readonly addCaseAttachmentUseCase: AddCaseAttachmentUseCase,
    private readonly getCaseAttachmentsUseCase: GetCaseAttachmentsUseCase,
    private readonly downloadCaseAttachmentUseCase: DownloadCaseAttachmentUseCase,
    private readonly deleteCaseAttachmentUseCase: DeleteCaseAttachmentUseCase,
    private readonly updateCaseInvestigationUseCase: UpdateCaseInvestigationUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Возвращает список всех case записей.' })
  @ApiOkResponse({ type: CaseListItemResponseDto, isArray: true })
  findAll() {
    return this.getCaseListUseCase.execute();
  }

  @Put(':caseId/reject')
  @ApiOperation({ summary: 'Отклоняет case с указанием причины отклонения.' })
  @ApiBody({ type: RejectCaseDto, required: true })
  @ApiOkResponse({ type: RejectCaseResponseDto })
  reject(@Param('caseId') caseId: string, @Body() body: RejectCaseDto) {
    return this.rejectCaseUseCase.execute(caseId, body);
  }

  @Put(':caseId/reopen')
  @ApiOperation({
    summary: 'Открывает ранее отклоненный case для повторной обработки.',
  })
  @ApiOkResponse({ type: CaseStateResponseDto })
  reopen(@Param('caseId') caseId: string) {
    return this.reopenCaseUseCase.execute(caseId);
  }

  @Patch(':caseId/investigation')
  @ApiOperation({
    summary: 'Обновляет результаты расследования по выбранному case.',
  })
  @ApiBody({ type: UpdateCaseInvestigationDto, required: true })
  @ApiOkResponse({ type: CaseWithInvestigationResponseDto })
  updateInvestigation(
    @Param('caseId') caseId: string,
    @Body() body: UpdateCaseInvestigationDto,
  ) {
    return this.updateCaseInvestigationUseCase.execute(caseId, body);
  }

  @Get(':caseId/comments')
  @ApiOperation({
    summary: 'Возвращает комментарии, связанные с выбранным case.',
  })
  @ApiOkResponse({ type: CaseCommentResponseDto, isArray: true })
  getComments(@Param('caseId') caseId: string) {
    return this.getCaseCommentsUseCase.execute(caseId);
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

  @Get(':caseId/attachments')
  @ApiOperation({
    summary: 'Возвращает список файлов-вложений выбранного case.',
  })
  @ApiOkResponse({ type: CaseAttachmentResponseDto, isArray: true })
  getAttachments(@Param('caseId') caseId: string) {
    return this.getCaseAttachmentsUseCase.execute(caseId);
  }

  @Get(':caseId/attachments/:attachmentId/download')
  @ApiOperation({
    summary: 'Скачивает файл-вложение по идентификатору записи вложения.',
  })
  @Header('Cache-Control', 'no-store')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    schema: { type: 'string', format: 'binary' },
  })
  async downloadAttachment(
    @Param('caseId') caseId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const file = await this.downloadCaseAttachmentUseCase.execute(
      caseId,
      attachmentId,
    );

    return new StreamableFile(file.stream, {
      type: file.contentType,
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Delete(':caseId/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удаляет файл-вложение по идентификатору записи (MinIO и запись в БД).',
  })
  @ApiResponse({ status: 204, description: 'Вложение удалено' })
  async deleteAttachment(
    @Param('caseId') caseId: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<void> {
    await this.deleteCaseAttachmentUseCase.execute(caseId, attachmentId);
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
