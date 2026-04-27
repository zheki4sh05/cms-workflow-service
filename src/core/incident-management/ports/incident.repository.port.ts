import { IncidentEntity } from '../domain/incident.entity';

export const INCIDENT_REPOSITORY = 'INCIDENT_REPOSITORY';

export interface IncidentRepositoryPort {
  save(incident: IncidentEntity): Promise<void>;
  findAll(): Promise<IncidentEntity[]>;
}
