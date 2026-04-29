import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { ActionPlanOrmEntity } from './action-plan.orm-entity';

@Entity({ name: 'verifications' })
@Unique('uq_verifications_action_plan_id', ['actionPlanId'])
export class VerificationOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => ActionPlanOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actionPlanId' })
  actionPlan!: ActionPlanOrmEntity;

  @Column({ type: 'uuid' })
  actionPlanId!: string;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @Column({ type: 'varchar', length: 255 })
  assignedUserForVerification!: string;

  @Column({ type: 'varchar', length: 255 })
  assignedEmployeeForVerification!: string;

  @Column({ type: 'text', nullable: true })
  comments!: string | null;
}
