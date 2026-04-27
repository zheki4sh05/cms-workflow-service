import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { IncidentTopicRule } from '../contracts/incident-topic-message.contract';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { OutboxMessageEntity } from '../../outbox/domain/outbox-message.entity';

interface IncidentOutboxPayload {
  companyId?: string;
  integrationId?: number;
  riskObjectId?: string;
  documentId?: string;
  rules?: IncidentTopicRule[];
}

@Injectable()
export class IncidentResolverService {
  private readonly logger = new Logger(IncidentResolverService.name);

  constructor(
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async resolveOutboxMessage(message: OutboxMessageEntity): Promise<void> {
    this.logger.log(`Incident resolver started: outboxMessageId=${message.id}`);
    const payload = message.payload as IncidentOutboxPayload;
    if (
      !payload?.companyId ||
      typeof payload.integrationId !== 'number' ||
      !payload.riskObjectId ||
      !Array.isArray(payload.rules)
    ) {
      this.logger.warn(`Invalid outbox payload, messageId=${message.id}`);
      return;
    }

    this.logger.log(
      `Incident payload validated: outboxMessageId=${message.id}, companyId=${payload.companyId}, integrationId=${payload.integrationId}, riskObjectId=${payload.riskObjectId}, rulesCount=${payload.rules.length}`,
    );
    const incidentId = randomUUID();
    this.logger.log(
      `Creating incident: incidentId=${incidentId}, outboxMessageId=${message.id}`,
    );
    await this.incidentRepository.save({
      id: incidentId,
      companyId: payload.companyId,
      integrationId: payload.integrationId,
      riskObjectId: payload.riskObjectId,
      documentId: payload.documentId ?? null,
      status: 'OPEN',
    });
    this.logger.log(
      `Incident created: incidentId=${incidentId}, status=OPEN, outboxMessageId=${message.id}`,
    );

    const caseIdByResponsibleUserId = new Map<string, string>();

    for (const rule of payload.rules) {
      const responsibleUserId = rule.responsible_user_id ?? 'UNASSIGNED';
      let caseId = caseIdByResponsibleUserId.get(responsibleUserId);

      if (!caseId) {
        caseId = randomUUID();
        caseIdByResponsibleUserId.set(responsibleUserId, caseId);

        await this.caseRepository.save({
          id: caseId,
          incidentId,
          responsibleUserId:
            responsibleUserId === 'UNASSIGNED' ? null : responsibleUserId,
          status: 'OPEN',
        });
      }

      await this.findingRepository.save({
        id: randomUUID(),
        priority: rule.rulePriority,
        assignedUserId:
          responsibleUserId === 'UNASSIGNED' ? null : responsibleUserId,
        details: rule.details ?? ((rule as { detaild?: Record<string, unknown> }).detaild ?? {}),
        incidentId,
        caseId,
      });
    }
  }
}
