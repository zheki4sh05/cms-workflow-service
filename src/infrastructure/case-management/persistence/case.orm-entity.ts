import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { IncidentOrmEntity } from '../../incident-management/persistence/incident.orm-entity';

export type CaseStatus = 'OPEN' | 'INVESTIGATING' | 'IN_PROGRESS' | 'CLOSED';

@Entity({ name: 'cases' })
@Unique('uq_cases_incident_assignee', ['incidentId', 'responsibleUserId'])
export class CaseOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => IncidentOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident!: IncidentOrmEntity;

  @Column({ type: 'uuid' })
  incidentId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  responsibleUserId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: CaseStatus;
}
