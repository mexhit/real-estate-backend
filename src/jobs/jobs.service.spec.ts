import { NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AreaPriceSnapshotJob } from '../areas/area-price-snapshot.job';

describe('JobsService', () => {
  it('runs the job registered under the given name', async () => {
    const areaPriceSnapshotJob = {
      run: jest.fn().mockResolvedValue({ status: 'completed', areas: [] }),
    };
    const service = new JobsService(
      areaPriceSnapshotJob as unknown as AreaPriceSnapshotJob,
    );

    const result = await service.run('area-price-snapshot');

    expect(areaPriceSnapshotJob.run).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'completed', areas: [] });
  });

  it('throws NotFoundException for an unknown job name', async () => {
    const areaPriceSnapshotJob = { run: jest.fn() };
    const service = new JobsService(
      areaPriceSnapshotJob as unknown as AreaPriceSnapshotJob,
    );

    await expect(service.run('does-not-exist')).rejects.toThrow(
      NotFoundException,
    );
  });
});
