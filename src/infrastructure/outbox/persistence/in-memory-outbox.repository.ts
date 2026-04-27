import { Injectable } from '@nestjs/common';
import { OutboxRepositoryPort } from '../../../core/outbox/ports/outbox.repository.port';
import { OutboxMessageEntity } from '../../../core/outbox/domain/outbox-message.entity';

@Injectable()
export class InMemoryOutboxRepository implements OutboxRepositoryPort {
  private readonly messages = new Map<string, OutboxMessageEntity>();

  async add(message: OutboxMessageEntity): Promise<void> {
    this.messages.set(message.id, message);
  }

  async getPending(limit: number): Promise<OutboxMessageEntity[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.status === 'pending')
      .slice(0, limit);
  }

  async markProcessed(id: string): Promise<void> {
    const current = this.messages.get(id);
    if (!current) return;

    this.messages.set(id, {
      ...current,
      status: 'processed',
      processedAt: new Date(),
      errorMessage: undefined,
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const current = this.messages.get(id);
    if (!current) return;

    this.messages.set(id, {
      ...current,
      status: 'failed',
      errorMessage,
    });
  }
}
