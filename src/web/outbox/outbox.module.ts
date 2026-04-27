import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxProcessorService } from '../../core/outbox/services/outbox-processor.service';
import { OUTBOX_REPOSITORY } from '../../core/outbox/ports/outbox.repository.port';
import { OutboxMessageOrmEntity } from '../../infrastructure/outbox/persistence/outbox-message.orm-entity';
import { PostgresOutboxRepository } from '../../infrastructure/outbox/persistence/postgres-outbox.repository';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessageOrmEntity])],
  providers: [
    OutboxProcessorService,
    PostgresOutboxRepository,
    {
      provide: OUTBOX_REPOSITORY,
      useExisting: PostgresOutboxRepository,
    },
  ],
  exports: [OUTBOX_REPOSITORY],
})
export class OutboxModule {}
