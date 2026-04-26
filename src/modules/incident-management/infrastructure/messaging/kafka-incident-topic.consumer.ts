import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { IncidentTopicMessage } from '../../application/contracts/incident-topic-message.contract';
import { IngestIncidentTopicUseCase } from '../../application/use-cases/ingest-incident-topic.use-case';

@Controller()
export class KafkaIncidentTopicConsumer {
  private readonly logger = new Logger(KafkaIncidentTopicConsumer.name);

  constructor(
    private readonly ingestIncidentTopicUseCase: IngestIncidentTopicUseCase,
  ) {}

  @EventPattern('incident_topic')
  async handleIncidentTopic(
    @Payload() payload: IncidentTopicMessage | { value: IncidentTopicMessage },
    @Ctx() context: KafkaContext,
  ) {
    const normalizedPayload =
      'value' in payload ? payload.value : (payload as IncidentTopicMessage);
    await this.ingestIncidentTopicUseCase.execute(normalizedPayload);

    const topic = context.getTopic();
    const partition = context.getPartition();
    this.logger.log(
      `Message consumed from topic=${topic}, partition=${partition}`,
    );
  }
}
