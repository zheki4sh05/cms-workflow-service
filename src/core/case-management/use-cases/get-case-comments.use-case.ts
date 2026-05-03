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
import { Repository } from 'typeorm';
import { CaseCommentOrmEntity } from '../../../infrastructure/case-management/persistence/case-comment.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../services/case-collaboration-access.service';

interface AuthUserPayload {
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
export class GetCaseCommentsUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(CaseCommentOrmEntity)
    private readonly commentRepository: Repository<CaseCommentOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
  ) {}

  async execute(caseId: string) {
    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }
    if (currentCase.status !== 'INVESTIGATING') {
      throw new BadRequestException(
        'Comments are available only for cases in INVESTIGATING status',
      );
    }

    await this.caseCollaborationAccessService.assertCanCollaborate(currentCase);

    const comments = await this.commentRepository.find({
      where: { caseId: currentCase.id },
      order: { time: 'ASC' },
    });

    const authorIds = Array.from(
      new Set(comments.map((item) => item.userId).filter(Boolean)),
    );
    const namesByUserId = await this.fetchUserDisplayNames(authorIds);

    return comments.map((item) => ({
      id: item.id,
      caseId: item.caseId,
      userId: item.userId,
      userName: namesByUserId.get(item.userId) ?? null,
      comment: item.comment,
      content: item.comment,
      time: item.time,
    }));
  }

  private resolveDisplayName(payload: AuthUserPayload): string | null {
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

  private async fetchUserDisplayNames(
    userIds: string[],
  ): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    if (userIds.length === 0) {
      return result;
    }

    const authServiceUrl = process.env.CMS_AUTH_SERVICE_URL;
    if (!authServiceUrl) {
      throw new BadRequestException('CMS_AUTH_SERVICE_URL is not configured');
    }

    const authorization = this.request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    await Promise.all(
      userIds.map(async (userId) => {
        const response = await fetch(
          `${authServiceUrl}/api/internal/users/${userId}`,
          {
            headers: { authorization },
          },
        );

        if (!response.ok) {
          result.set(userId, null);
          return;
        }

        const payload = (await response.json()) as AuthUserPayload;
        result.set(userId, this.resolveDisplayName(payload));
      }),
    );

    return result;
  }
}
