import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IncidentTopicMessage } from '../contracts/incident-topic-message.contract';
import {
  OUTBOX_REPOSITORY,
  OutboxRepositoryPort,
} from '../../../../shared/outbox/application/ports/outbox.repository.port';

@Injectable()
export class IngestIncidentTopicUseCase {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepositoryPort,
  ) {}

  async execute(message: IncidentTopicMessage): Promise<void> {
    if (!message?.companyId || !message?.riskObjectId || !Array.isArray(message?.rules)) {
      return;
    }

    const outboxPayload = {
      companyId: message.companyId,
      integrationId: message.integrationId,
      riskObjectId: message.riskObjectId,
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
  }
}
