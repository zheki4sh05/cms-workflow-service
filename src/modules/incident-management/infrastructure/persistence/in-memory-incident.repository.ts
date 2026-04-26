import { Injectable } from '@nestjs/common';
import { IncidentRepositoryPort } from '../../application/ports/incident.repository.port';
import { IncidentEntity } from '../../domain/incident.entity';

@Injectable()
export class InMemoryIncidentRepository implements IncidentRepositoryPort {
  private readonly incidents = new Map<string, IncidentEntity>();

  async save(incident: IncidentEntity): Promise<void> {
    this.incidents.set(incident.id, incident);
  }

  async findAll(): Promise<IncidentEntity[]> {
    return Array.from(this.incidents.values());
  }
}
