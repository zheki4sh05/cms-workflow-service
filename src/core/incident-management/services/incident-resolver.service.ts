import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { IncidentTopicRule } from '../contracts/incident-topic-message.contract';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { OutboxMessageEntity } from '../../outbox/domain/outbox-message.entity';

interface IncidentOutboxPayload {
  companyId?: string;
  integrationId?: number;
  riskObjectId?: string;
  documentId?: string;
  rules?: IncidentTopicRule[];
}

interface RiskObjectResponse {
  departmentId?: string | null;
}

@Injectable()
export class IncidentResolverService {
  private readonly logger = new Logger(IncidentResolverService.name);

  constructor(private readonly dataSource: DataSource) {}

  async resolveOutboxMessage(message: OutboxMessageEntity): Promise<void> {
    this.logger.log(`Incident resolver started: outboxMessageId=${message.id}`);
    const payload = message.payload as IncidentOutboxPayload;
    if (
      !payload?.companyId ||
      typeof payload.integrationId !== 'number' ||
      !payload.riskObjectId ||
      !Array.isArray(payload.rules) ||
      payload.rules.length === 0
    ) {
      this.logger.warn(`Invalid outbox payload, messageId=${message.id}`);
      return;
    }

    this.logger.log(
      `Incident payload validated: outboxMessageId=${message.id}, companyId=${payload.companyId}, integrationId=${payload.integrationId}, riskObjectId=${payload.riskObjectId}, rulesCount=${payload.rules.length}`,
    );
    const incidentId = randomUUID();
    this.logger.log(
      `Creating incident: incidentId=${incidentId}, outboxMessageId=${message.id}`,
    );
    const departmentId = await this.fetchDepartmentIdByRiskObject(
      payload.riskObjectId!,
      payload.companyId!,
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.save(IncidentOrmEntity, {
        id: incidentId,
        companyId: payload.companyId!,
        integrationId: payload.integrationId!,
        riskObjectId: payload.riskObjectId!,
        departmentId,
        documentId: payload.documentId ?? null,
        status: 'OPEN',
      });

      for (const rule of payload.rules!) {
        const assignedUserId = rule.responsible_user_id ?? 'UNASSIGNED';
        const findingId = randomUUID();

        await manager.save(FindingOrmEntity, {
          id: findingId,
          priority: rule.rulePriority,
          assignedUserId:
            assignedUserId === 'UNASSIGNED' ? null : assignedUserId,
          rulesId: rule.rulesId ?? null,
          detectedAt: this.resolveDetectedAt(rule.detectedAt),
          details: {
            ...(rule.details ??
              (rule as { detaild?: Record<string, unknown> }).detaild ??
              {}),
          },
          incidentId,
        });
      }
    });

    this.logger.log(
      `Incident graph created: incidentId=${incidentId}, status=OPEN, outboxMessageId=${message.id}`,
    );
  }

  private async fetchDepartmentIdByRiskObject(
    riskObjectId: string,
    companyId: string,
  ): Promise<string | null> {
    const monitoringServiceUrl = process.env.CMS_MONITORING_SERVICE_URL;
    if (!monitoringServiceUrl) {
      this.logger.error('CMS_MONITORING_SERVICE_URL is not configured');
      return null;
    }

    const url = `${monitoringServiceUrl}/api/internal/risk-objects/${riskObjectId}`;
    this.logger.log(`Risk API request: GET ${url} CompanyId=${companyId}`);
    const response = await fetch(url, {
      headers: {
        CompanyId: companyId,
      },
    });
    this.logger.log(
      `Risk API response: GET ${url} status=${response.status} CompanyId=${companyId}`,
    );

    if (!response.ok) {
      const body = await this.readErrorBody(response);
      this.logger.warn(
        `Risk API error while fetching departmentId: GET ${url} status=${response.status} body=${body}`,
      );
      return null;
    }

    const riskObject = (await response.json()) as RiskObjectResponse;
    return riskObject.departmentId ?? null;
  }

  private resolveDetectedAt(rawDetectedAt?: string): Date {
    if (rawDetectedAt) {
      const parsed = new Date(rawDetectedAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
      this.logger.warn(`Invalid rule detectedAt received: ${rawDetectedAt}`);
    }
    return new Date();
  }

  private async readErrorBody(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return '<unavailable>';
    }
  }
}
