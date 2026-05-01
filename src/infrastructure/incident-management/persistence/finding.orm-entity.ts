import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { IncidentOrmEntity } from './incident.orm-entity';
import { CaseOrmEntity } from '../../case-management/persistence/case.orm-entity';

@Entity({ name: 'findings' })
export class FindingOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  priority!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  rulesId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  detectedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deadline!: Date | null;

  @Column({ type: 'jsonb' })
  details!: Record<string, unknown>;

  @ManyToOne(() => IncidentOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident!: IncidentOrmEntity;

  @Column({ type: 'uuid' })
  incidentId!: string;

  @OneToMany(() => CaseOrmEntity, (incidentCase) => incidentCase.finding)
  cases!: CaseOrmEntity[];
}
