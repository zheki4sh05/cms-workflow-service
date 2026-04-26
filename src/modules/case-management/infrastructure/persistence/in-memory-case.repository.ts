import { Injectable } from '@nestjs/common';
import { CaseRepositoryPort } from '../../application/ports/case.repository.port';
import { CaseAggregate } from '../../domain/case.aggregate';

@Injectable()
export class InMemoryCaseRepository implements CaseRepositoryPort {
  private readonly cases = new Map<string, CaseAggregate>();

  async save(caseAggregate: CaseAggregate): Promise<void> {
    this.cases.set(caseAggregate.id, caseAggregate);
  }

  async findAll(): Promise<CaseAggregate[]> {
    return Array.from(this.cases.values());
  }
}
