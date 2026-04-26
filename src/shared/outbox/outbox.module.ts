import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxProcessorService } from './application/services/outbox-processor.service';
import { OUTBOX_REPOSITORY } from './application/ports/outbox.repository.port';
import { OutboxMessageOrmEntity } from './infrastructure/persistence/outbox-message.orm-entity';
import { PostgresOutboxRepository } from './infrastructure/persistence/postgres-outbox.repository';

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
