import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OUTBOX_REPOSITORY } from '../ports/outbox.repository.port';
import type { OutboxRepositoryPort } from '../ports/outbox.repository.port';
import { IncidentResolverService } from '../../incident-management/services/incident-resolver.service';
import { getNumberEnvOrDefault, loadEnvFile } from '../../../web/app/env';

loadEnvFile();

const OUTBOX_RESOLVER_INTERVAL_MINUTES = getNumberEnvOrDefault(
  'OUTBOX_RESOLVER_INTERVAL_MINUTES',
  1,
);
const OUTBOX_RESOLVER_CRON =
  OUTBOX_RESOLVER_INTERVAL_MINUTES <= 1
    ? '* * * * *'
    : `*/${OUTBOX_RESOLVER_INTERVAL_MINUTES} * * * *`;

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepositoryPort,
    private readonly incidentResolverService: IncidentResolverService,
  ) {}

  @Cron(OUTBOX_RESOLVER_CRON)
  async processPendingMessages() {
    this.logger.log(
      `Outbox scheduler started: cron=${OUTBOX_RESOLVER_CRON}, intervalMinutes=${OUTBOX_RESOLVER_INTERVAL_MINUTES}`,
    );
    const statusStats = await this.outboxRepository.getStatusStats();
    this.logger.log(`Outbox status stats: ${JSON.stringify(statusStats)}`);
    const pendingMessages = await this.outboxRepository.getPending(100);
    this.logger.log(
      `Outbox scheduler fetched pending messages: count=${pendingMessages.length}`,
    );

    for (const message of pendingMessages) {
      try {
        this.logger.log(
          `Outbox message read: id=${message.id}, topic=${message.topic}, status=${message.status}`,
        );
        if (message.topic !== 'incident_topic.received') {
          this.logger.log(
            `Outbox message skipped by topic: id=${message.id}, topic=${message.topic}`,
          );
          await this.outboxRepository.markProcessed(message.id);
          continue;
        }

        this.logger.log(
          `Outbox message accepted for incident resolver: id=${message.id}`,
        );
        await this.incidentResolverService.resolveOutboxMessage(message);
        await this.outboxRepository.markProcessed(message.id);
        this.logger.log(
          `Incident outbox message processed: ${message.id}, topic=${message.topic}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        await this.outboxRepository.markFailed(message.id, errorMessage);
        this.logger.error(
          `Outbox message failed: ${message.id}, error=${errorMessage}`,
        );
      }
    }

    const deletedProcessedCount = await this.outboxRepository.deleteProcessed();
    this.logger.log(
      `Outbox cleanup finished: deletedProcessedCount=${deletedProcessedCount}`,
    );
    this.logger.log('Outbox scheduler finished current run');
  }
}
