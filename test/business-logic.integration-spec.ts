import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { RejectCaseUseCase } from '../src/core/case-management/use-cases/reject-case.use-case';
import { ReopenCaseUseCase } from '../src/core/case-management/use-cases/reopen-case.use-case';
import { IngestIncidentTopicUseCase } from '../src/core/incident-management/use-cases/ingest-incident-topic.use-case';
import { AssignIncidentToMeUseCase } from '../src/core/incident-management/use-cases/assign-incident-to-me.use-case';
import { CreateActionPlanUseCase } from '../src/core/action-plan-management/use-cases/create-action-plan.use-case';
import { SubmitActionPlanUseCase } from '../src/core/action-plan-management/use-cases/submit-action-plan.use-case';
import { IncidentResolverService } from '../src/core/incident-management/services/incident-resolver.service';
import { CaseOrmEntity } from '../src/infrastructure/case-management/persistence/case.orm-entity';
import { IncidentOrmEntity } from '../src/infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../src/infrastructure/incident-management/persistence/finding.orm-entity';
import { ActionPlanOrmEntity } from '../src/infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../src/infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { VerificationOrmEntity } from '../src/infrastructure/action-plan-management/persistence/verification.orm-entity';
import { InMemoryOutboxRepository } from '../src/infrastructure/outbox/persistence/in-memory-outbox.repository';
import { OUTBOX_REPOSITORY } from '../src/core/outbox/ports/outbox.repository.port';
import { InMemoryTypeOrmRepository } from './helpers/in-memory-typeorm.repository';
import { createInMemoryDataSource } from './helpers/in-memory-data-source';

describe('Business logic integration', () => {
  let rejectCaseUseCase: RejectCaseUseCase;
  let reopenCaseUseCase: ReopenCaseUseCase;
  let ingestIncidentTopicUseCase: IngestIncidentTopicUseCase;
  let assignIncidentToMeUseCase: AssignIncidentToMeUseCase;
  let createActionPlanUseCase: CreateActionPlanUseCase;
  let submitActionPlanUseCase: SubmitActionPlanUseCase;
  let incidentResolverService: IncidentResolverService;
  let caseRepository: InMemoryTypeOrmRepository<CaseOrmEntity>;
  let incidentRepository: InMemoryTypeOrmRepository<IncidentOrmEntity>;
  let findingRepository: InMemoryTypeOrmRepository<FindingOrmEntity>;
  let actionPlanRepository: InMemoryTypeOrmRepository<ActionPlanOrmEntity>;
  let actionPlanTaskRepository: InMemoryTypeOrmRepository<ActionPlanTaskOrmEntity>;
  let verificationRepository: InMemoryTypeOrmRepository<VerificationOrmEntity>;
  let outboxRepository: InMemoryOutboxRepository;

  const authFetchMock = jest.fn();

  beforeEach(async () => {
    caseRepository = new InMemoryTypeOrmRepository<CaseOrmEntity>('id');
    incidentRepository = new InMemoryTypeOrmRepository<IncidentOrmEntity>('id');
    findingRepository = new InMemoryTypeOrmRepository<FindingOrmEntity>('id');
    actionPlanRepository = new InMemoryTypeOrmRepository<ActionPlanOrmEntity>('id');
    actionPlanTaskRepository = new InMemoryTypeOrmRepository<ActionPlanTaskOrmEntity>(
      'id',
    );
    verificationRepository = new InMemoryTypeOrmRepository<VerificationOrmEntity>(
      'id',
    );
    outboxRepository = new InMemoryOutboxRepository();

    process.env.CMS_AUTH_SERVICE_URL = 'http://auth.test';
    process.env.CMS_MONITORING_SERVICE_URL = 'http://monitoring.test';
    process.env.CMS_COMPANY_INFO_SERVICE_URL = 'http://company-info.test';
    authFetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.includes('/api/internal/risk-objects/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ departmentId: 'dept-1' }),
        });
      }
      if (url.includes('/api/internal/users/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ roles: ['MANAGER'] }),
        });
      }
      if (url.includes('/employee/department-manager')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            departmentId: 'dept-1',
            employeeId: 'supervisor-emp',
            userId: 'supervisor-user',
            companyId: 'company-1',
            role: 'SUPERVISOR',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'user-1',
          companyId: 'company-1',
          employeeId: 'emp-1',
        }),
      });
    });
    global.fetch = authFetchMock as typeof fetch;

    const assignAndIncidentDataSource = createInMemoryDataSource({
      cases: caseRepository,
      findings: findingRepository,
      incidents: incidentRepository,
    });

    assignIncidentToMeUseCase = new AssignIncidentToMeUseCase(
      {
        headers: { authorization: 'Bearer test-token' },
      } as Request,
      assignAndIncidentDataSource,
      incidentRepository.asRepository(),
      caseRepository.asRepository(),
      findingRepository.asRepository(),
    );

    createActionPlanUseCase = new CreateActionPlanUseCase(
      createInMemoryDataSource({
        cases: caseRepository,
        actionPlans: actionPlanRepository,
        actionPlanTasks: actionPlanTaskRepository,
      }),
      caseRepository.asRepository(),
      actionPlanRepository.asRepository(),
      actionPlanTaskRepository.asRepository(),
    );

    submitActionPlanUseCase = new SubmitActionPlanUseCase(
      {
        headers: {
          authorization: 'Bearer test-token',
          employeeid: 'emp-1',
        },
        header: (name: string) =>
          name.toLowerCase() === 'employeeid' ? 'emp-1' : undefined,
      } as Request,
      createInMemoryDataSource({
        cases: caseRepository,
        actionPlans: actionPlanRepository,
        verifications: verificationRepository,
      }),
      actionPlanRepository.asRepository(),
      caseRepository.asRepository(),
      verificationRepository.asRepository(),
    );

    incidentResolverService = new IncidentResolverService(
      createInMemoryDataSource({
        incidents: incidentRepository,
        findings: findingRepository,
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        RejectCaseUseCase,
        ReopenCaseUseCase,
        IngestIncidentTopicUseCase,
        {
          provide: getRepositoryToken(CaseOrmEntity),
          useValue: caseRepository.asRepository(),
        },
        {
          provide: getRepositoryToken(IncidentOrmEntity),
          useValue: incidentRepository.asRepository(),
        },
        {
          provide: getRepositoryToken(ActionPlanOrmEntity),
          useValue: actionPlanRepository.asRepository(),
        },
        {
          provide: OUTBOX_REPOSITORY,
          useValue: outboxRepository,
        },
      ],
    }).compile();

    rejectCaseUseCase = moduleRef.get(RejectCaseUseCase);
    reopenCaseUseCase = moduleRef.get(ReopenCaseUseCase);
    ingestIncidentTopicUseCase = moduleRef.get(IngestIncidentTopicUseCase);
  });

  const seedIncidentGraph = async (params?: {
    caseStatus?: CaseOrmEntity['status'];
    incidentStatus?: IncidentOrmEntity['status'];
  }) => {
    const incidentId = randomUUID();
    const findingId = randomUUID();
    const caseId = randomUUID();

    incidentRepository.seed({
      id: incidentId,
      companyId: 'company-1',
      integrationId: 1,
      riskObjectId: 'risk-1',
      departmentId: null,
      documentId: null,
      status: params?.incidentStatus ?? 'IN_PROGRESS',
      resolvedDate: null,
    });

    caseRepository.seed({
      id: caseId,
      incidentId,
      findingId,
      assignedUserId: 'user-1',
      status: params?.caseStatus ?? 'INVESTIGATING',
    });

    return { incidentId, findingId, caseId };
  };

  it('rejects investigating case and resolves incident when it is the only case', async () => {
    const { caseId, incidentId } = await seedIncidentGraph();

    const result = await rejectCaseUseCase.execute(caseId, {
      comment: 'Not enough evidence',
    });

    expect(result).toEqual({
      caseId,
      caseStatus: 'REJECTED',
      incidentId,
      incidentStatus: 'RESOLVED',
    });

    const savedIncident = await incidentRepository.findOne({
      where: { id: incidentId },
    });
    expect(savedIncident?.status).toBe('RESOLVED');
    expect(savedIncident?.resolvedDate).toBeInstanceOf(Date);

    const actionPlans = actionPlanRepository.getAll();
    expect(actionPlans).toHaveLength(1);
    expect(actionPlans[0]).toMatchObject({
      caseId,
      incidentId,
      comment: 'Not enough evidence',
    });
  });

  it('requires comment when rejecting a case', async () => {
    const { caseId } = await seedIncidentGraph();

    await expect(rejectCaseUseCase.execute(caseId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows rejection only from INVESTIGATING status', async () => {
    const { caseId } = await seedIncidentGraph({ caseStatus: 'ASSIGNED' });

    await expect(
      rejectCaseUseCase.execute(caseId, { comment: 'Too early' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reopens case from REJECTED back to INVESTIGATING', async () => {
    const { caseId } = await seedIncidentGraph({ caseStatus: 'REJECTED' });

    const result = await reopenCaseUseCase.execute(caseId);

    expect(result).toEqual({
      caseId,
      caseStatus: 'INVESTIGATING',
    });

    const savedCase = await caseRepository.findOne({ where: { id: caseId } });
    expect(savedCase?.status).toBe('INVESTIGATING');
  });

  it('allows reopen only from REJECTED status', async () => {
    const { caseId } = await seedIncidentGraph({ caseStatus: 'INVESTIGATING' });

    await expect(reopenCaseUseCase.execute(caseId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates ASSIGNED case when manager claims unassigned finding', async () => {
    const incidentId = randomUUID();
    const findingId = randomUUID();

    incidentRepository.seed({
      id: incidentId,
      companyId: 'company-1',
      integrationId: 1,
      riskObjectId: 'risk-1',
      departmentId: null,
      documentId: null,
      status: 'OPEN',
      resolvedDate: null,
    });

    findingRepository.seed({
      id: findingId,
      incidentId,
      priority: 'HIGH',
      assignedUserId: null,
      rulesId: null,
      detectedAt: new Date(),
      deadline: null,
      details: { code: 'R1' },
    });

    const cases = await assignIncidentToMeUseCase.execute(incidentId);

    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      incidentId,
      findingId,
      assignedUserId: 'user-1',
      status: 'ASSIGNED',
    });
    expect(cases[0].id).toBeDefined();

    const updatedFinding = await findingRepository.findOne({
      where: { id: findingId },
    });
    expect(updatedFinding?.assignedUserId).toBe('user-1');

    const updatedIncident = await incidentRepository.findOne({
      where: { id: incidentId },
    });
    expect(updatedIncident?.status).toBe('IN_PROGRESS');

    expect(caseRepository.getAll()).toHaveLength(1);
  });

  it('creates OPEN incident and findings from outbox message', async () => {
    await incidentResolverService.resolveOutboxMessage({
      id: randomUUID(),
      topic: 'incident_topic.received',
      payload: {
        companyId: 'company-1',
        integrationId: 99,
        riskObjectId: 'risk-99',
        documentId: 'doc-1',
        rules: [
          {
            rulesId: 'rule-1',
            rulePriority: 'HIGH',
            responsible_user_id: 'user-2',
            result: 'fail',
            found: true,
            details: { code: 'R1' },
          },
        ],
      },
      createdAt: new Date(),
      status: 'pending',
    });

    const incidents = incidentRepository.getAll();
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      companyId: 'company-1',
      integrationId: 99,
      riskObjectId: 'risk-99',
      documentId: 'doc-1',
      status: 'OPEN',
      departmentId: 'dept-1',
    });

    const findings = findingRepository.getAll();
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      incidentId: incidents[0].id,
      priority: 'HIGH',
      assignedUserId: 'user-2',
      rulesId: 'rule-1',
    });
    expect(findings[0].details).toEqual({ code: 'R1' });
  });

  it('creates action plan with tasks and sets case to ACTION_PLAN', async () => {
    const { caseId, incidentId } = await seedIncidentGraph({
      caseStatus: 'INVESTIGATING',
    });

    const result = await createActionPlanUseCase.execute({
      caseId,
      title: 'Corrective plan',
      description: 'Steps to fix the issue',
      tasks: [
        {
          title: 'Task 1',
          description: 'Do something',
          priority: 'HIGH',
          dueDate: '2026-12-31T00:00:00.000Z',
        },
      ],
    });

    expect(result).toMatchObject({
      caseId,
      caseStatus: 'ACTION_PLAN',
      title: 'Corrective plan',
      description: 'Steps to fix the issue',
      showTasks: false,
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      title: 'Task 1',
      priority: 'HIGH',
      status: 'TODO',
    });

    expect(actionPlanRepository.getAll()).toHaveLength(1);
    expect(actionPlanRepository.getAll()[0]).toMatchObject({
      caseId,
      incidentId,
      title: 'Corrective plan',
      showTasks: false,
    });
    expect(actionPlanTaskRepository.getAll()).toHaveLength(1);

    const savedCase = await caseRepository.findOne({ where: { id: caseId } });
    expect(savedCase?.status).toBe('ACTION_PLAN');
  });

  it('submit creates verification row and moves case to WAITING_VERIFICATION', async () => {
    const { caseId, incidentId } = await seedIncidentGraph({
      caseStatus: 'ACTION_PLAN',
    });

    const plan = await createActionPlanUseCase.execute({
      caseId,
      title: 'Plan for verification',
      description: 'Submit me',
      tasks: [],
    });

    const result = await submitActionPlanUseCase.execute(plan.id);

    expect(result.status).toBe('WAITING_VERIFICATION');
    expect(verificationRepository.getAll()).toHaveLength(1);
    expect(verificationRepository.getAll()[0]).toMatchObject({
      actionPlanId: plan.id,
      verified: false,
      assignedUserForVerification: 'supervisor-user',
      assignedEmployeeForVerification: 'supervisor-emp',
    });

    const savedCase = await caseRepository.findOne({ where: { id: caseId } });
    expect(savedCase?.status).toBe('WAITING_VERIFICATION');

    const savedPlan = await actionPlanRepository.findOne({
      where: { id: plan.id },
    });
    expect(savedPlan).toMatchObject({
      caseId,
      incidentId,
      showTasks: false,
    });
  });

  it('ingests incident topic into outbox through Nest DI wiring', async () => {
    await ingestIncidentTopicUseCase.execute({
      companyId: 'company-1',
      integrationId: 7,
      riskObjectId: 'risk-42',
      rules: [
        {
          rulesId: 'rule-1',
          rulePriority: 'LOW',
          responsible_user_id: null,
          result: 'fail',
          found: true,
          details: {},
        },
      ],
    });

    const pending = await outboxRepository.getPending(5);
    expect(pending).toHaveLength(1);
    expect(pending[0].payload).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        integrationId: 7,
        riskObjectId: 'risk-42',
      }),
    );
  });
});
