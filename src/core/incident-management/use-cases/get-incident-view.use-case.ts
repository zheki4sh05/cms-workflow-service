import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';

interface IntegrationConfigResponse {
  number?: number;
  name?: string;
}

@Injectable()
export class GetIncidentViewUseCase {
  constructor(
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async execute(incidentId: string) {
    const incident = await this.incidentRepository.findOne({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const findings = await this.findingRepository.find({
      where: { incidentId: incident.id },
      order: { id: 'ASC' },
    });

    const integration = await this.fetchIntegrationConfig(
      incident.integrationId,
      incident.companyId,
    );

    return {
      findings,
      documentId: incident.documentId ?? null,
      integrationId: integration.number ?? incident.integrationId,
      integrationName: integration.name ?? null,
    };
  }

  private async fetchIntegrationConfig(
    integrationId: number,
    companyId: string,
  ): Promise<IntegrationConfigResponse> {
    const monitoringServiceUrl = process.env.CMS_MONITORING_SERVICE_URL?.trim();
    if (!monitoringServiceUrl) {
      throw new BadRequestException('CMS_MONITORING_SERVICE_URL is not configured');
    }

    const response = await fetch(
      `${monitoringServiceUrl}/api/internal/integration-configs/${integrationId}`,
      {
        headers: {
          CompanyId: companyId,
        },
      },
    );
    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = '';
      }
      throw new BadRequestException(
        `Unable to fetch integration config: status ${response.status}${errorBody ? `, body: ${errorBody}` : ''}`,
      );
    }

    return (await response.json()) as IntegrationConfigResponse;
  }
}
