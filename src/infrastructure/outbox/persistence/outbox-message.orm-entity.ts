import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { OutboxMessageStatus } from '../../../core/outbox/domain/outbox-message.entity';

@Entity({ name: 'outbox_messages' })
export class OutboxMessageOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  topic!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 20 })
  status!: OutboxMessageStatus;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;
}
