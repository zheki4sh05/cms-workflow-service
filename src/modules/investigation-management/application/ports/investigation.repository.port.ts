import { InvestigationEntity } from '../../domain/investigation.entity';

export const INVESTIGATION_REPOSITORY = 'INVESTIGATION_REPOSITORY';

export interface InvestigationRepositoryPort {
  save(investigation: InvestigationEntity): Promise<void>;
  findAll(): Promise<InvestigationEntity[]>;
}
