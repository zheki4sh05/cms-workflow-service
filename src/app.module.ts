import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CaseManagementModule } from './modules/case-management/case-management.module';
import { IncidentManagementModule } from './modules/incident-management/incident-management.module';
import { ActionPlanManagementModule } from './modules/action-plan-management/action-plan-management.module';
import { InvestigationManagementModule } from './modules/investigation-management/investigation-management.module';
import { OutboxModule } from './shared/outbox/outbox.module';
import { OutboxMessageOrmEntity } from './shared/outbox/infrastructure/persistence/outbox-message.orm-entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'cms_workflow',
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
