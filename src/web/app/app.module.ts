import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentManagementModule } from '../incident-management/incident-management.module';
import { OutboxModule } from '../outbox/outbox.module';
import { OutboxMessageOrmEntity } from '../../infrastructure/outbox/persistence/outbox-message.orm-entity';
import { getRequiredEnv, getRequiredNumberEnv, loadEnvFile } from './env';
import { CreateIncidentCaseFindingTables1745751900000 } from '../../infrastructure/database/migrations/1745751900000-create-incident-case-finding-tables';
import { AddStatusToCases1745757600000 } from '../../infrastructure/database/migrations/1745757600000-add-status-to-cases';
import { CreateOutboxMessagesTable1745860200000 } from '../../infrastructure/database/migrations/1745860200000-create-outbox-messages-table';
import { AlignCaseFindingAssigneeModel1745863800000 } from '../../infrastructure/database/migrations/1745863800000-align-case-finding-assignee-model';
import { CreateActionPlansTable1745866500000 } from '../../infrastructure/database/migrations/1745866500000-create-action-plans-table';
import { DropLegacyFindingsCaseId1745867400000 } from '../../infrastructure/database/migrations/1745867400000-drop-legacy-findings-case-id';
import { CreateCaseCommentsAndAttachments1745870400000 } from '../../infrastructure/database/migrations/1745870400000-create-case-comments-and-attachments';
import { AddActionPlanTasksAndFields1745874300000 } from '../../infrastructure/database/migrations/1745874300000-add-action-plan-tasks-and-fields';
import { CaseManagementModule } from '../case-management/case-management.module';
import { ActionPlanManagementModule } from '../action-plan-management/action-plan-management.module';

loadEnvFile();

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: getRequiredEnv('DB_HOST'),
      port: getRequiredNumberEnv('DB_PORT'),
      username: getRequiredEnv('DB_USER'),
      password: getRequiredEnv('DB_PASSWORD'),
      database: getRequiredEnv('DB_NAME'),
      migrations: [
        CreateIncidentCaseFindingTables1745751900000,
        AddStatusToCases1745757600000,
        CreateOutboxMessagesTable1745860200000,
        AlignCaseFindingAssigneeModel1745863800000,
        CreateActionPlansTable1745866500000,
        DropLegacyFindingsCaseId1745867400000,
        CreateCaseCommentsAndAttachments1745870400000,
        AddActionPlanTasksAndFields1745874300000,
      ],
      migrationsRun: process.env.DB_RUN_MIGRATIONS === 'true',
      entities: [OutboxMessageOrmEntity],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      autoLoadEntities: true,
    }),
    OutboxModule,
    IncidentManagementModule,
    CaseManagementModule,
    ActionPlanManagementModule,
  ],
})
export class AppModule {}
