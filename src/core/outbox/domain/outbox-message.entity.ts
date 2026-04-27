export type OutboxMessageStatus = 'pending' | 'processed' | 'failed';

export interface OutboxMessageEntity {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  status: OutboxMessageStatus;
  processedAt?: Date;
  errorMessage?: string;
}
