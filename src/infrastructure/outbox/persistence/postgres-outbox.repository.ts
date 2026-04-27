import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxRepositoryPort } from '../../../core/outbox/ports/outbox.repository.port';
import { OutboxMessageEntity } from '../../../core/outbox/domain/outbox-message.entity';
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

  async getStatusStats(): Promise<Record<string, number>> {
    const rows = await this.outboxRepository
      .createQueryBuilder('outbox')
      .select('outbox.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('outbox.status')
      .getRawMany<{ status: string; count: string }>();

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {});
  }

  async deleteProcessed(): Promise<number> {
    const result = await this.outboxRepository.delete({ status: 'processed' });
    return result.affected ?? 0;
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
