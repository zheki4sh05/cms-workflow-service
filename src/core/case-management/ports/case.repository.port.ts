import { CaseAggregate } from '../domain/case.aggregate';

export const CASE_REPOSITORY = 'CASE_REPOSITORY';

export interface CaseRepositoryPort {
  save(caseAggregate: CaseAggregate): Promise<void>;
  findAll(): Promise<CaseAggregate[]>;
}
