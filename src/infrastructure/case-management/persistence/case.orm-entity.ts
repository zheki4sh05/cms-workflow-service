import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { IncidentOrmEntity } from '../../incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../incident-management/persistence/finding.orm-entity';

export type CaseStatus =
  | 'ASSIGNED'
  | 'ACTION_PLAN'
  | 'OPEN'
  | 'INVESTIGATING'
  | 'IN_PROGRESS'
  | 'REJECTED'
  | 'CLOSED';

@Entity({ name: 'cases' })
@Unique('uq_cases_incident_assignee', ['incidentId', 'findingId', 'assignedUserId'])
export class CaseOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => IncidentOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident!: IncidentOrmEntity;

  @Column({ type: 'uuid' })
  incidentId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedUserId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: CaseStatus;

  @ManyToOne(() => FindingOrmEntity, (finding) => finding.cases, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'findingId' })
  finding!: FindingOrmEntity;

  @Column({ type: 'uuid' })
  findingId!: string;
}
