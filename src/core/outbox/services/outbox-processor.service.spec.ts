import { OutboxProcessorService } from './outbox-processor.service';
import { InMemoryOutboxRepository } from '../../../infrastructure/outbox/persistence/in-memory-outbox.repository';
import { IncidentResolverService } from '../../incident-management/services/incident-resolver.service';
import { OutboxMessageEntity } from '../domain/outbox-message.entity';

describe('OutboxProcessorService', () => {
  let outboxRepository: InMemoryOutboxRepository;
  let incidentResolver: { resolveOutboxMessage: jest.Mock };
  let service: OutboxProcessorService;

  beforeEach(() => {
    outboxRepository = new InMemoryOutboxRepository();
    incidentResolver = { resolveOutboxMessage: jest.fn().mockResolvedValue(undefined) };
    service = new OutboxProcessorService(
      outboxRepository,
      incidentResolver as unknown as IncidentResolverService,
    );
  });

  const seedMessage = async (
    partial: Partial<OutboxMessageEntity> & Pick<OutboxMessageEntity, 'id' | 'topic'>,
  ) => {
    await outboxRepository.add({
      id: partial.id,
      topic: partial.topic,
      payload: partial.payload ?? {},
      createdAt: partial.createdAt ?? new Date(),
      status: partial.status ?? 'pending',
    });
  };

  it('marks non-incident topics as processed without calling resolver', async () => {
    await seedMessage({ id: 'msg-1', topic: 'other.topic' });

    await service.processPendingMessages();

    expect(incidentResolver.resolveOutboxMessage).not.toHaveBeenCalled();
    const pending = await outboxRepository.getPending(10);
    expect(pending).toHaveLength(0);
  });

  it('delegates incident_topic.received messages to incident resolver', async () => {
    await seedMessage({
      id: 'msg-2',
      topic: 'incident_topic.received',
      payload: { companyId: 'c1', integrationId: 1, riskObjectId: 'r1', rules: [] },
    });

    await service.processPendingMessages();

    expect(incidentResolver.resolveOutboxMessage).toHaveBeenCalledTimes(1);
    expect(incidentResolver.resolveOutboxMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg-2', topic: 'incident_topic.received' }),
    );
    const pending = await outboxRepository.getPending(10);
    expect(pending).toHaveLength(0);
  });
});
