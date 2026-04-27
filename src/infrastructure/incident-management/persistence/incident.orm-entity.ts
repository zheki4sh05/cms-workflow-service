import { Column, Entity, PrimaryColumn } from 'typeorm';

export type IncidentStatus = 'OPEN' | 'RESOLVED';

@Entity({ name: 'incident' })
export class IncidentOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  companyId!: string;

  @Column({ type: 'int' })
  integrationId!: number;

  @Column({ type: 'varchar', length: 255 })
  riskObjectId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentId?: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: IncidentStatus;
}
