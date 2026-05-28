import { InMemoryOutboxRepository } from './in-memory-outbox.repository';

describe('InMemoryOutboxRepository', () => {
  it('returns only pending messages up to the requested limit', async () => {
    const repository = new InMemoryOutboxRepository();

    await repository.add({
      id: 'pending-1',
      topic: 'incident_topic.received',
      payload: {},
      createdAt: new Date(),
      status: 'pending',
    });
    await repository.add({
      id: 'pending-2',
      topic: 'incident_topic.received',
      payload: {},
      createdAt: new Date(),
      status: 'pending',
    });
    await repository.add({
      id: 'processed-1',
      topic: 'incident_topic.received',
      payload: {},
      createdAt: new Date(),
      status: 'processed',
    });

    const pending = await repository.getPending(1);

    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
  });
});
