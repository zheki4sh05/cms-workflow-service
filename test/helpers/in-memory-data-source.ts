import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { ActionPlanOrmEntity } from '../../src/infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../src/infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { VerificationOrmEntity } from '../../src/infrastructure/action-plan-management/persistence/verification.orm-entity';
import { CaseOrmEntity } from '../../src/infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../src/infrastructure/incident-management/persistence/finding.orm-entity';
import { IncidentOrmEntity } from '../../src/infrastructure/incident-management/persistence/incident.orm-entity';
import { InMemoryTypeOrmRepository } from './in-memory-typeorm.repository';

export type InMemoryDataSourceRepos = {
  cases?: InMemoryTypeOrmRepository<CaseOrmEntity>;
  findings?: InMemoryTypeOrmRepository<FindingOrmEntity>;
  incidents?: InMemoryTypeOrmRepository<IncidentOrmEntity>;
  actionPlans?: InMemoryTypeOrmRepository<ActionPlanOrmEntity>;
  actionPlanTasks?: InMemoryTypeOrmRepository<ActionPlanTaskOrmEntity>;
  verifications?: InMemoryTypeOrmRepository<VerificationOrmEntity>;
};

function repoForEntity(
  entity: EntityTarget<ObjectLiteral>,
  repos: InMemoryDataSourceRepos,
): InMemoryTypeOrmRepository<ObjectLiteral> | null {
  if (entity === CaseOrmEntity) {
    return (repos.cases as InMemoryTypeOrmRepository<ObjectLiteral>) ?? null;
  }
  if (entity === FindingOrmEntity) {
    return (repos.findings as InMemoryTypeOrmRepository<ObjectLiteral>) ?? null;
  }
  if (entity === IncidentOrmEntity) {
    return (repos.incidents as InMemoryTypeOrmRepository<ObjectLiteral>) ?? null;
  }
  if (entity === ActionPlanOrmEntity) {
    return (repos.actionPlans as InMemoryTypeOrmRepository<ObjectLiteral>) ?? null;
  }
  if (entity === ActionPlanTaskOrmEntity) {
    return (
      repos.actionPlanTasks as InMemoryTypeOrmRepository<ObjectLiteral>
    ) ?? null;
  }
  if (entity === VerificationOrmEntity) {
    return (
      repos.verifications as InMemoryTypeOrmRepository<ObjectLiteral>
    ) ?? null;
  }
  return null;
}

export function createInMemoryDataSource(
  repos: InMemoryDataSourceRepos,
): DataSource {
  const manager = {
    findOne: async <T extends ObjectLiteral>(
      entity: EntityTarget<T>,
      options: { where: Partial<T> },
    ): Promise<T | null> => {
      const repo = repoForEntity(entity, repos);
      return (repo?.findOne(options) as Promise<T | null>) ?? null;
    },
    save: async <T extends ObjectLiteral>(
      entity: EntityTarget<T>,
      data: T,
    ): Promise<T> => {
      const repo = repoForEntity(entity, repos);
      if (!repo) {
        throw new Error(`No in-memory repository configured for entity`);
      }
      return repo.save(data) as Promise<T>;
    },
    update: async <T extends ObjectLiteral>(
      entity: EntityTarget<T>,
      criteria: Partial<T>,
      partial: Partial<T>,
    ): Promise<void> => {
      const repo = repoForEntity(entity, repos);
      await repo?.update(criteria, partial);
    },
    upsert: async <T extends ObjectLiteral>(
      target: EntityTarget<T>,
      entity: T,
      conflictPaths: (keyof T)[],
    ): Promise<void> => {
      const repo = repoForEntity(target, repos);
      if (!repo) {
        throw new Error(`No in-memory repository configured for entity`);
      }
      await repo.upsert(entity, conflictPaths);
    },
  };

  return {
    transaction: async <T>(fn: (em: typeof manager) => Promise<T>) => fn(manager),
  } as unknown as DataSource;
}
