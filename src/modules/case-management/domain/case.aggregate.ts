export type CaseStatus = 'open' | 'in_progress' | 'closed';

export interface CaseAggregate {
  id: string;
  title: string;
  status: CaseStatus;
  incidentIds: string[];
}
