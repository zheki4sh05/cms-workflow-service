import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnvFile, getRequiredEnv, getRequiredNumberEnv } from '../../web/app/env';
import { OutboxMessageOrmEntity } from '../outbox/persistence/outbox-message.orm-entity';
import { IncidentOrmEntity } from '../incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../incident-management/persistence/finding.orm-entity';
import { ActionPlanOrmEntity } from '../action-plan-management/persistence/action-plan.orm-entity';
import { CaseCommentOrmEntity } from '../case-management/persistence/case-comment.orm-entity';
import { CaseAttachmentOrmEntity } from '../case-management/persistence/case-attachment.orm-entity';
import { ActionPlanTaskOrmEntity } from '../action-plan-management/persistence/action-plan-task.orm-entity';

loadEnvFile();

export default new DataSource({
  type: 'postgres',
  host: getRequiredEnv('DB_HOST'),
  port: getRequiredNumberEnv('DB_PORT'),
  username: getRequiredEnv('DB_USER'),
  password: getRequiredEnv('DB_PASSWORD'),
  database: getRequiredEnv('DB_NAME'),
  entities: [
    OutboxMessageOrmEntity,
    IncidentOrmEntity,
    CaseOrmEntity,
    FindingOrmEntity,
    ActionPlanOrmEntity,
    ActionPlanTaskOrmEntity,
    CaseCommentOrmEntity,
    CaseAttachmentOrmEntity,
  ],
  migrations: ['src/infrastructure/database/migrations/*.ts'],
});
