import { Module } from '@nestjs/common';
import { GetIncidentListUseCase } from './application/use-cases/get-incident-list.use-case';
import { IngestIncidentTopicUseCase } from './application/use-cases/ingest-incident-topic.use-case';
import { INCIDENT_REPOSITORY } from './application/ports/incident.repository.port';
import { InMemoryIncidentRepository } from './infrastructure/persistence/in-memory-incident.repository';
import { IncidentController } from './web/incident.controller';
import { KafkaIncidentTopicConsumer } from './infrastructure/messaging/kafka-incident-topic.consumer';

@Module({
  controllers: [IncidentController, KafkaIncidentTopicConsumer],
  providers: [
    GetIncidentListUseCase,
    IngestIncidentTopicUseCase,
    InMemoryIncidentRepository,
    {
      provide: INCIDENT_REPOSITORY,
      useExisting: InMemoryIncidentRepository,
    },
  ],
})
export class IncidentManagementModule {}
