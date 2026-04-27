import { OutboxMessageEntity } from '../domain/outbox-message.entity';

export const OUTBOX_REPOSITORY = 'OUTBOX_REPOSITORY';

export interface OutboxRepositoryPort {
  add(message: OutboxMessageEntity): Promise<void>;
  getPending(limit: number): Promise<OutboxMessageEntity[]>;
  getStatusStats(): Promise<Record<string, number>>;
  deleteProcessed(): Promise<number>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
}
