export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'new' | 'investigating' | 'resolved';

export interface IncidentEntity {
  id: string;
  caseId: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  dueAt?: Date;
}
