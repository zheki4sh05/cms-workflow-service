import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CaseOrmEntity } from '../../case-management/persistence/case.orm-entity';

@Entity({ name: 'investigations' })
export class InvestigationOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @OneToOne(() => CaseOrmEntity, (currentCase) => currentCase.investigation, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'caseId' })
  case!: CaseOrmEntity;

  @Column({ type: 'uuid', unique: true })
  caseId!: string;

  @Column({ type: 'text' })
  investigationNotes!: string;

  @Column({ type: 'text' })
  rootCause!: string;

  @Column({ type: 'boolean' })
  requiresCorrectiveAction!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
