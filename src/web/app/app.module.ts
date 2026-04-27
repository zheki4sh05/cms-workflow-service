import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CaseManagementModule } from '../case-management/case-management.module';
import { IncidentManagementModule } from '../incident-management/incident-management.module';
import { ActionPlanManagementModule } from '../action-plan-management/action-plan-management.module';
import { InvestigationManagementModule } from '../investigation-management/investigation-management.module';
import { OutboxModule } from '../outbox/outbox.module';
import { OutboxMessageOrmEntity } from '../../infrastructure/outbox/persistence/outbox-message.orm-entity';
import { getRequiredEnv, getRequiredNumberEnv, loadEnvFile } from './env';

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
      entities: [OutboxMessageOrmEntity],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      autoLoadEntities: true,
    }),
    OutboxModule,
    CaseManagementModule,
    IncidentManagementModule,
    ActionPlanManagementModule,
    InvestigationManagementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
