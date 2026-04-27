import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetCaseListUseCase } from '../../core/case-management/use-cases/get-case-list.use-case';
import { RejectCaseUseCase } from '../../core/case-management/use-cases/reject-case.use-case';
import { RejectCaseDto } from './dto/reject-case.dto';
import { ReopenCaseUseCase } from '../../core/case-management/use-cases/reopen-case.use-case';
import { AddCaseCommentUseCase } from '../../core/case-management/use-cases/add-case-comment.use-case';
import { CreateCaseCommentDto } from './dto/create-case-comment.dto';
import { AddCaseAttachmentUseCase } from '../../core/case-management/use-cases/add-case-attachment.use-case';
import { GetCaseCommentsUseCase } from '../../core/case-management/use-cases/get-case-comments.use-case';
import { GetCaseAttachmentsUseCase } from '../../core/case-management/use-cases/get-case-attachments.use-case';
import { UploadedFile as UploadedBinaryFile } from '../../core/case-management/types/uploaded-file.type';

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
  ) {}

  @Get()
  findAll() {
    return this.getCaseListUseCase.execute();
  }

  @Put(':caseId/reject')
  @ApiBody({ type: RejectCaseDto, required: true })
  reject(@Param('caseId') caseId: string, @Body() body: RejectCaseDto) {
    return this.rejectCaseUseCase.execute(caseId, body);
  }

  @Put(':caseId/reopen')
  reopen(@Param('caseId') caseId: string) {
    return this.reopenCaseUseCase.execute(caseId);
  }

  @Get(':caseId/comments')
  getComments(@Param('caseId') caseId: string) {
    return this.getCaseCommentsUseCase.execute(caseId);
  }

  @Post(':caseId/comments')
  @ApiBody({ type: CreateCaseCommentDto, required: true })
  addComment(
    @Param('caseId') caseId: string,
    @Body() body: CreateCaseCommentDto,
  ) {
    return this.addCaseCommentUseCase.execute(caseId, body);
  }

  @Get(':caseId/attachments')
  getAttachments(@Param('caseId') caseId: string) {
    return this.getCaseAttachmentsUseCase.execute(caseId);
  }

  @Post(':caseId/attachments')
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
  addAttachment(@Param('caseId') caseId: string, @UploadedFile() file?: UploadedBinaryFile) {
    return this.addCaseAttachmentUseCase.execute(caseId, { file });
  }
}
