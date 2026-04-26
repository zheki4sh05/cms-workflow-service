import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  OUTBOX_REPOSITORY,
  OutboxRepositoryPort,
} from '../ports/outbox.repository.port';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepositoryPort,
  ) {}

  @Cron('*/30 * * * * *')
  async processPendingMessages() {
    const pendingMessages = await this.outboxRepository.getPending(100);

    for (const message of pendingMessages) {
      try {
        // Stub for next iteration: publish/process message with external transport.
        this.logger.log(
          `Outbox message processed: ${message.id}, topic=${message.topic}`,
        );
        await this.outboxRepository.markProcessed(message.id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        await this.outboxRepository.markFailed(message.id, errorMessage);
        this.logger.error(
          `Outbox message failed: ${message.id}, error=${errorMessage}`,
        );
      }
    }
  }
}
