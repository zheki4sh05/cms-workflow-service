import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCommentOrmEntity } from '../../../infrastructure/case-management/persistence/case-comment.orm-entity';
import { CaseCollaborationAccessService } from '../services/case-collaboration-access.service';

interface AddCaseCommentPayload {
  content?: string;
}

interface AuthMePayload {
  id?: string;
  name?: string;
  fullName?: string;
  displayName?: string;
  login?: string;
  email?: string;
  user?: {
    name?: string;
    fullName?: string;
    displayName?: string;
    login?: string;
    email?: string;
  };
}

@Injectable()
export class AddCaseCommentUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(CaseCommentOrmEntity)
    private readonly commentRepository: Repository<CaseCommentOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
  ) {}

  async execute(caseId: string, payload: AddCaseCommentPayload) {
    const content = payload.content?.trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }
    const user =
      await this.caseCollaborationAccessService.assertCanCollaborate(
        currentCase,
      );

    const created = await this.commentRepository.save({
      id: randomUUID(),
      caseId: currentCase.id,
      userId: user.id,
      comment: content,
      time: new Date(),
    });

    const userName = await this.fetchAuthorDisplayName();

    return {
      id: created.id,
      caseId: created.caseId,
      userId: created.userId,
      userName,
      comment: created.comment,
      content: created.comment,
      time: created.time,
    };
  }

  private async fetchAuthorDisplayName(): Promise<string | null> {
    const authServiceUrl = process.env.CMS_AUTH_SERVICE_URL;
    if (!authServiceUrl) {
      throw new BadRequestException('CMS_AUTH_SERVICE_URL is not configured');
    }

    const authorization = this.request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const response = await fetch(`${authServiceUrl}/api/users/me`, {
      headers: { authorization },
    });
    if (!response.ok) {
      throw new UnauthorizedException('Unable to fetch current user');
    }

    const payload = (await response.json()) as AuthMePayload;
    const nested = payload.user ?? {};

    const candidates = [
      payload.name,
      payload.fullName,
      payload.displayName,
      nested.name,
      nested.fullName,
      nested.displayName,
      nested.login,
      payload.login,
      nested.email,
      payload.email,
    ];

    const resolved = candidates.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

    return resolved?.trim() ?? null;
  }
}
