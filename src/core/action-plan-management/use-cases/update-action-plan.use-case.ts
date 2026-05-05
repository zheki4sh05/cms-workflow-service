import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Scope,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../../case-management/services/case-collaboration-access.service';

export interface UpdateActionPlanPayload {
  title?: string;
  description?: string;
  comment?: string | null;
}

@Injectable({ scope: Scope.REQUEST })
export class UpdateActionPlanUseCase {
  constructor(
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
  ) {}

  async execute(planId: string, payload: UpdateActionPlanPayload) {
    const hasTitle = payload.title !== undefined;
    const hasDescription = payload.description !== undefined;
    const hasComment = payload.comment !== undefined;
    if (!hasTitle && !hasDescription && !hasComment) {
      throw new BadRequestException(
        'At least one of title, description, comment must be provided',
      );
    }

    const actionPlan = await this.actionPlanRepository.findOne({
      where: { id: planId },
    });
    if (!actionPlan) {
      throw new NotFoundException('Action plan not found');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: actionPlan.caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    const user =
      await this.caseCollaborationAccessService.assertCanCollaborate(
        currentCase,
      );
    const roles =
      await this.caseCollaborationAccessService.fetchUserRoles(user.id);
    if (!roles.includes('MANAGER')) {
      throw new ForbiddenException('Only manager can update action plan');
    }

    if (payload.title !== undefined) {
      if (typeof payload.title !== 'string') {
        throw new BadRequestException('title must be a string');
      }
      const trimmed = payload.title.trim();
      actionPlan.title = trimmed.length > 0 ? trimmed : null;
    }
    if (payload.description !== undefined) {
      if (typeof payload.description !== 'string') {
        throw new BadRequestException('description must be a string');
      }
      const trimmed = payload.description.trim();
      actionPlan.description = trimmed.length > 0 ? trimmed : null;
    }
    if (payload.comment !== undefined) {
      if (payload.comment === null) {
        actionPlan.comment = null;
      } else if (typeof payload.comment === 'string') {
        const trimmed = payload.comment.trim();
        actionPlan.comment = trimmed.length > 0 ? trimmed : null;
      } else if (
        typeof payload.comment === 'number' ||
        typeof payload.comment === 'boolean'
      ) {
        const trimmed = String(payload.comment).trim();
        actionPlan.comment = trimmed.length > 0 ? trimmed : null;
      } else {
        throw new BadRequestException('comment must be a string, number, boolean or null');
      }
    }

    await this.actionPlanRepository.save(actionPlan);

    return {
      id: actionPlan.id,
      caseId: actionPlan.caseId,
      incidentId: actionPlan.incidentId,
      title: actionPlan.title,
      description: actionPlan.description,
      comment: actionPlan.comment,
      showTasks: actionPlan.showTasks,
    };
  }
}