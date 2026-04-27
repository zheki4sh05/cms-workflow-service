import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxProcessorService } from '../../core/outbox/services/outbox-processor.service';
import { OUTBOX_REPOSITORY } from '../../core/outbox/ports/outbox.repository.port';
import { OutboxMessageOrmEntity } from '../../infrastructure/outbox/persistence/outbox-message.orm-entity';
import { PostgresOutboxRepository } from '../../infrastructure/outbox/persistence/postgres-outbox.repository';
import { IncidentResolverService } from '../../core/incident-management/services/incident-resolver.service';
import { IncidentOrmEntity } from '../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../../infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../infrastructure/incident-management/persistence/finding.orm-entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutboxMessageOrmEntity,
      IncidentOrmEntity,
      CaseOrmEntity,
      FindingOrmEntity,
    ]),
  ],
  providers: [
    OutboxProcessorService,
    IncidentResolverService,
    PostgresOutboxRepository,
    {
      provide: OUTBOX_REPOSITORY,
      useExisting: PostgresOutboxRepository,
    },
  ],
  exports: [OUTBOX_REPOSITORY],
})
export class OutboxModule {}
