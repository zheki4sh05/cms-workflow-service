import { IngestIncidentTopicUseCase } from './ingest-incident-topic.use-case';
import { InMemoryOutboxRepository } from '../../../infrastructure/outbox/persistence/in-memory-outbox.repository';
import { IncidentTopicMessage } from '../contracts/incident-topic-message.contract';

describe('IngestIncidentTopicUseCase', () => {
  let useCase: IngestIncidentTopicUseCase;
  let outboxRepository: InMemoryOutboxRepository;

  beforeEach(() => {
    outboxRepository = new InMemoryOutboxRepository();
    useCase = new IngestIncidentTopicUseCase(outboxRepository);
  });

  it('ignores message when companyId is missing', async () => {
    await useCase.execute({
      companyId: '',
      integrationId: 1,
      riskObjectId: 'risk-1',
      rules: [],
    } as IncidentTopicMessage);

    const pending = await outboxRepository.getPending(10);
    expect(pending).toHaveLength(0);
  });

  it('persists pending outbox message for valid incident topic', async () => {
    const message: IncidentTopicMessage = {
      companyId: 'company-1',
      integrationId: 42,
      riskObjectId: 'risk-1',
      documentId: 'doc-1',
      rules: [
        {
          rulesId: 'rule-1',
          rulePriority: 'HIGH',
          responsible_user_id: 'user-1',
          result: 'fail',
          found: true,
          details: { code: 'X1' },
        },
      ],
    };

    await useCase.execute(message);

    const pending = await outboxRepository.getPending(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      topic: 'incident_topic.received',
      status: 'pending',
      payload: expect.objectContaining({
        companyId: 'company-1',
        integrationId: 42,
        riskObjectId: 'risk-1',
        documentId: 'doc-1',
        rules: message.rules,
      }),
    });
  });
});
