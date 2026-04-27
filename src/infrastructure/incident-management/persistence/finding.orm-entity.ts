import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { IncidentOrmEntity } from './incident.orm-entity';

@Entity({ name: 'findings' })
export class FindingOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  priority!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedUserId!: string | null;

  @Column({ type: 'jsonb' })
  details!: Record<string, unknown>;

  @ManyToOne(() => IncidentOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident!: IncidentOrmEntity;

  @Column({ type: 'uuid' })
  incidentId!: string;

  @Column({ type: 'uuid' })
  caseId!: string;
}
