import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CaseOrmEntity } from './case.orm-entity';

@Entity({ name: 'case_attachments' })
export class CaseAttachmentOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => CaseOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case!: CaseOrmEntity;

  @Column({ type: 'uuid' })
  caseId!: string;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  fileId!: string;

  @Column({ name: 'time', type: 'timestamptz' })
  time!: Date;

  @Column({ type: 'varchar', length: 512 })
  name!: string;
}
