import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ActionPlanTaskOrmEntity } from './action-plan-task.orm-entity';

@Entity({ name: 'action_plan_task_evidences' })
export class ActionPlanTaskEvidenceOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => ActionPlanTaskOrmEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task!: ActionPlanTaskOrmEntity;

  @Column({ type: 'uuid' })
  taskId!: string;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: 'uuid' })
  fileId!: string;

  @Column({ type: 'varchar', length: 500 })
  name!: string;

  @Column({ type: 'timestamptz' })
  time!: Date;
}
