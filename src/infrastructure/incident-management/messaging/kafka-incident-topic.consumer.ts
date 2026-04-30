import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';
import { IncidentTopicMessage } from '../../../core/incident-management/contracts/incident-topic-message.contract';
import { IngestIncidentTopicUseCase } from '../../../core/incident-management/use-cases/ingest-incident-topic.use-case';
import { getRequiredEnv, loadEnvFile } from '../../../web/app/env';

loadEnvFile();
const INCIDENT_TOPIC = getRequiredEnv('KAFKA_INCIDENT_TOPIC');

@Controller()
export class KafkaIncidentTopicConsumer {
  private readonly logger = new Logger(KafkaIncidentTopicConsumer.name);

  constructor(
    private readonly ingestIncidentTopicUseCase: IngestIncidentTopicUseCase,
  ) {}

  @EventPattern(INCIDENT_TOPIC)
  async handleIncidentTopic(
    @Payload() payload: IncidentTopicMessage | { value: IncidentTopicMessage },
    @Ctx() context: KafkaContext,
  ) {
    const normalizedPayload = 'value' in payload ? payload.value : payload;
    await this.ingestIncidentTopicUseCase.execute(normalizedPayload);

    const topic = context.getTopic();
    const partition = context.getPartition();
    this.logger.log(
      `Message consumed from topic=${topic}, partition=${partition}`,
    );
  }
}
