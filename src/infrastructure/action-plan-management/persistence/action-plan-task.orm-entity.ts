import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ActionPlanOrmEntity } from './action-plan.orm-entity';

export type ActionPlanTaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type ActionPlanTaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

@Entity({ name: 'action_plan_tasks' })
export class ActionPlanTaskOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => ActionPlanOrmEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actionPlanId' })
  actionPlan!: ActionPlanOrmEntity;

  @Column({ type: 'uuid' })
  actionPlanId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 20 })
  priority!: ActionPlanTaskPriority;

  @Column({ type: 'timestamptz' })
  dueDate!: Date;

  @Column({ type: 'varchar', length: 20, default: 'TODO' })
  status!: ActionPlanTaskStatus;

  @Column({ type: 'text', nullable: true })
  evidenceDescriptionInprogress!: string | null;

  @Column({ type: 'text', nullable: true })
  evidenceDescriptionDone!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
