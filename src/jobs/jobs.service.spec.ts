import { NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AreaPriceSnapshotJob } from '../areas/area-price-snapshot.job';
import { PropertyAiEnrichmentJob } from '../properties/property-ai-enrichment.job';

describe('JobsService', () => {
  it('runs the job registered under the given name', async () => {
    const areaPriceSnapshotJob = {
      run: jest.fn().mockResolvedValue({ status: 'completed', areas: [] }),
    };
    const service = new JobsService(
      areaPriceSnapshotJob as unknown as AreaPriceSnapshotJob,
      { run: jest.fn() } as unknown as PropertyAiEnrichmentJob,
    );

    const result = await service.run('area-price-snapshot');

    expect(areaPriceSnapshotJob.run).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'completed', areas: [] });
  });

  it('throws NotFoundException for an unknown job name', async () => {
    const areaPriceSnapshotJob = { run: jest.fn() };
    const service = new JobsService(
      areaPriceSnapshotJob as unknown as AreaPriceSnapshotJob,
      { run: jest.fn() } as unknown as PropertyAiEnrichmentJob,
    );

    await expect(service.run('does-not-exist')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('runs the property AI enrichment job under its own name', async () => {
    const propertyAiEnrichmentJob = {
      run: jest.fn().mockResolvedValue({
        status: 'completed',
        metadataUpdated: 3,
        furnishedDecided: 2,
      }),
    };
    const service = new JobsService(
      { run: jest.fn() } as unknown as AreaPriceSnapshotJob,
      propertyAiEnrichmentJob as unknown as PropertyAiEnrichmentJob,
    );

    const result = await service.run('property-ai-enrichment');

    expect(propertyAiEnrichmentJob.run).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'completed',
      metadataUpdated: 3,
      furnishedDecided: 2,
    });
  });
});
