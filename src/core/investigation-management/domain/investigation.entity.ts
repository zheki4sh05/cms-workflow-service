export type InvestigationStatus = 'not_started' | 'in_progress' | 'verified' | 'closed';

export interface InvestigationEntity {
  id: string;
  caseId: string;
  incidentId: string;
  status: InvestigationStatus;
  startedAt?: Date;
  verifiedAt?: Date;
}
