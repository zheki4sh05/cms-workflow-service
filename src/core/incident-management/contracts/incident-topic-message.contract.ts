export interface IncidentTopicRule {
  rulesId: string;
  rulePriority: string;
  responsible_user_id: string | null;
  result: string;
  found: boolean;
  details: Record<string, unknown>;
}

export interface IncidentTopicMessage {
  companyId: string;
  integrationId: number;
  riskObjectId: string;
  documentId?: string;
  rules: IncidentTopicRule[];
}
