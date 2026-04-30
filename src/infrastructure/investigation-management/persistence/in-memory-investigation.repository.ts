import { Injectable } from '@nestjs/common';
import { InvestigationRepositoryPort } from '../../../core/investigation-management/ports/investigation.repository.port';
import { InvestigationEntity } from '../../../core/investigation-management/domain/investigation.entity';

@Injectable()
export class InMemoryInvestigationRepository implements InvestigationRepositoryPort {
  private readonly investigations = new Map<string, InvestigationEntity>();

  async save(investigation: InvestigationEntity): Promise<void> {
    this.investigations.set(investigation.id, investigation);
  }

  async findAll(): Promise<InvestigationEntity[]> {
    return Array.from(this.investigations.values());
  }
}
