import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { ActionPlanTaskEvidenceOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task-evidence.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../../case-management/services/case-collaboration-access.service';

@Injectable()
export class GetActionPlanTaskEvidencesUseCase {
  constructor(
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(ActionPlanTaskEvidenceOrmEntity)
    private readonly evidenceRepository: Repository<ActionPlanTaskEvidenceOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
  ) {}

  async execute(actionPlanId: string, taskId: string) {
    const actionPlan = await this.actionPlanRepository.findOne({
      where: { id: actionPlanId },
    });
    if (!actionPlan) {
      throw new NotFoundException('Action plan not found');
    }

    const task = await this.actionPlanTaskRepository.findOne({
      where: { id: taskId, actionPlanId: actionPlan.id },
    });
    if (!task) {
      throw new NotFoundException('Action plan task not found');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: actionPlan.caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    if (currentCase.status !== 'ACTION_IN_PROGRESS') {
      throw new BadRequestException(
        'Task evidences are available only for cases in ACTION_IN_PROGRESS status',
      );
    }

    await this.caseCollaborationAccessService.assertCanCollaborate(currentCase);

    const evidences = await this.evidenceRepository.find({
      where: { taskId: task.id },
      order: { time: 'ASC' },
    });

    return evidences.map((item) => ({
      id: item.id,
      actionPlanId,
      taskId: item.taskId,
      userId: item.userId,
      fileId: item.fileId,
      name: item.name,
      time: item.time,
    }));
  }
}
