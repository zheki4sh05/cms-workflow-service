import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxRepositoryPort } from '../../application/ports/outbox.repository.port';
import { OutboxMessageEntity } from '../../domain/outbox-message.entity';
import { OutboxMessageOrmEntity } from './outbox-message.orm-entity';

@Injectable()
export class PostgresOutboxRepository implements OutboxRepositoryPort {
  constructor(
    @InjectRepository(OutboxMessageOrmEntity)
    private readonly outboxRepository: Repository<OutboxMessageOrmEntity>,
  ) {}

  async add(message: OutboxMessageEntity): Promise<void> {
    await this.outboxRepository.save({
      ...message,
    });
  }

  async getPending(limit: number): Promise<OutboxMessageEntity[]> {
    return this.outboxRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async markProcessed(id: string): Promise<void> {
    await this.outboxRepository.update(
      { id },
      {
        status: 'processed',
        processedAt: new Date(),
        errorMessage: undefined,
      },
    );
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.outboxRepository.update(
      { id },
      {
        status: 'failed',
        errorMessage,
      },
    );
  }
}
