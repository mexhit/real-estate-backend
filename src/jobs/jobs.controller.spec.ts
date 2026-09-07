import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

describe('JobsController', () => {
  let controller: JobsController;
  let jobsService: { run: jest.Mock };

  beforeEach(async () => {
    jobsService = { run: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: jobsService,
        },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
  });

  it('delegates running a job by name to JobsService', async () => {
    const result = { status: 'completed', areas: [] };
    jobsService.run.mockResolvedValue(result);

    await expect(controller.run('area-price-snapshot')).resolves.toBe(
      result,
    );
    expect(jobsService.run).toHaveBeenCalledWith('area-price-snapshot');
  });
});
