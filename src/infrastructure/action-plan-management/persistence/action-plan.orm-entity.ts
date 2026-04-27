import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { CaseOrmEntity } from '../../case-management/persistence/case.orm-entity';
import { IncidentOrmEntity } from '../../incident-management/persistence/incident.orm-entity';
import { ActionPlanTaskOrmEntity } from './action-plan-task.orm-entity';

@Entity({ name: 'action_plans' })
@Unique('uq_action_plans_case_id', ['caseId'])
export class ActionPlanOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => CaseOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case!: CaseOrmEntity;

  @Column({ type: 'uuid' })
  caseId!: string;

  @ManyToOne(() => IncidentOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident!: IncidentOrmEntity;

  @Column({ type: 'uuid' })
  incidentId!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @OneToMany(() => ActionPlanTaskOrmEntity, (task) => task.actionPlan)
  tasks!: ActionPlanTaskOrmEntity[];
}
