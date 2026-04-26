export type ActionTaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue';

export interface ActionTaskEntity {
  id: string;
  title: string;
  assigneeId?: string;
  status: ActionTaskStatus;
  dueAt?: Date;
}

export interface ActionPlanEntity {
  id: string;
  caseId: string;
  incidentId?: string;
  tasks: ActionTaskEntity[];
}
