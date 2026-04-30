import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';

@Injectable()
export class ReopenCaseUseCase {
  constructor(
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
  ) {}

  async execute(caseId: string) {
    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    if (currentCase.status !== 'REJECTED') {
      throw new BadRequestException(
        'Case can be reopened only from REJECTED status',
      );
    }

    currentCase.status = 'INVESTIGATING';
    await this.caseRepository.save(currentCase);

    return {
      caseId: currentCase.id,
      caseStatus: currentCase.status,
    };
  }
}
