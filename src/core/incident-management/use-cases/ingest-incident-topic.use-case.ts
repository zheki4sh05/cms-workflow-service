import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IncidentTopicMessage } from '../contracts/incident-topic-message.contract';
import { OUTBOX_REPOSITORY } from '../../outbox/ports/outbox.repository.port';
import type { OutboxRepositoryPort } from '../../outbox/ports/outbox.repository.port';

@Injectable()
export class IngestIncidentTopicUseCase {
  private readonly logger = new Logger(IngestIncidentTopicUseCase.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepositoryPort,
  ) {}

  async execute(message: IncidentTopicMessage): Promise<void> {
    if (
      !message?.companyId ||
      !message?.riskObjectId ||
      !Array.isArray(message?.rules)
    ) {
      this.logger.warn('Incident topic message ignored due to invalid payload');
      return;
    }

    const outboxPayload = {
      companyId: message.companyId,
      integrationId: message.integrationId,
      riskObjectId: message.riskObjectId,
      documentId: message.documentId,
      rules: message.rules,
      receivedAt: new Date().toISOString(),
    };

    await this.outboxRepository.add({
      id: randomUUID(),
      topic: 'incident_topic.received',
      payload: outboxPayload,
      createdAt: new Date(),
      status: 'pending',
    });
    this.logger.log(
      `Outbox message created from incident topic: companyId=${message.companyId}, riskObjectId=${message.riskObjectId}, rulesCount=${message.rules.length}`,
    );
  }
}
