import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ActionPlanOrmEntity } from './action-plan.orm-entity';

export type ActionPlanTaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

@Entity({ name: 'action_plan_tasks' })
export class ActionPlanTaskOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => ActionPlanOrmEntity, { nullable: false, onDelete: 'CASCADE' })
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
}
