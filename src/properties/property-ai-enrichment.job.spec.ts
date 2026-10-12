import { Logger } from '@nestjs/common';
import { PropertyAiEnrichmentJob } from './property-ai-enrichment.job';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

describe('PropertyAiEnrichmentJob', () => {
  let job: PropertyAiEnrichmentJob;
  let propertiesService: {
    findPropertiesNeedingAiMetadata: jest.Mock;
    updatePropertiesFromAi: jest.Mock;
    findPropertiesNeedingFurnishedDecision: jest.Mock;
    updateFurnishedFromDecisions: jest.Mock;
  };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    propertiesService = {
      findPropertiesNeedingAiMetadata: jest.fn(),
      updatePropertiesFromAi: jest.fn(),
      findPropertiesNeedingFurnishedDecision: jest.fn().mockResolvedValue([]),
      updateFurnishedFromDecisions: jest.fn().mockResolvedValue([]),
    };

    job = new PropertyAiEnrichmentJob(
      propertiesService as unknown as PropertiesService,
    );
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('updates a batch of properties from AI metadata in one call every run', async () => {
    const properties = [{ id: 1 }, { id: 2 }] as Property[];

    propertiesService.findPropertiesNeedingAiMetadata.mockResolvedValue(
      properties,
    );
    propertiesService.updatePropertiesFromAi.mockResolvedValue(properties);

    await job.updatePropertiesFromAi();

    expect(
      propertiesService.findPropertiesNeedingAiMetadata,
    ).toHaveBeenCalledWith(10);
    expect(propertiesService.updatePropertiesFromAi).toHaveBeenCalledTimes(1);
    expect(propertiesService.updatePropertiesFromAi).toHaveBeenCalledWith(
      properties,
    );
  });

  it('does nothing when there are no properties needing AI metadata', async () => {
    propertiesService.findPropertiesNeedingAiMetadata.mockResolvedValue([]);

    await job.updatePropertiesFromAi();

    expect(propertiesService.updatePropertiesFromAi).not.toHaveBeenCalled();
  });

  it('logs and recovers when the batch update fails', async () => {
    const properties = [{ id: 1 }, { id: 2 }] as Property[];

    propertiesService.findPropertiesNeedingAiMetadata.mockResolvedValue(
      properties,
    );
    propertiesService.updatePropertiesFromAi.mockRejectedValue(
      new Error('AI batch timeout'),
    );

    await job.updatePropertiesFromAi();

    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to update a batch of 2 properties from AI',
      expect.stringContaining('AI batch timeout'),
    );
  });

  it('decides furnished status even when no properties need AI metadata', async () => {
    const properties = [{ id: 7 }] as Property[];

    propertiesService.findPropertiesNeedingAiMetadata.mockResolvedValue([]);
    propertiesService.findPropertiesNeedingFurnishedDecision.mockResolvedValue(
      properties,
    );

    await job.updatePropertiesFromAi();

    expect(propertiesService.updateFurnishedFromDecisions).toHaveBeenCalledWith(
      properties,
    );
  });

  it('still decides furnished status when metadata enrichment fails', async () => {
    propertiesService.findPropertiesNeedingAiMetadata.mockResolvedValue([
      { id: 1 },
    ]);
    propertiesService.updatePropertiesFromAi.mockRejectedValue(
      new Error('boom'),
    );

    await job.updatePropertiesFromAi();

    expect(
      propertiesService.findPropertiesNeedingFurnishedDecision,
    ).toHaveBeenCalledWith(10);
  });

  it('run() reports how many properties were enriched and decided', async () => {
    propertiesService.findPropertiesNeedingAiMetadata.mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ]);
    propertiesService.updatePropertiesFromAi.mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ]);
    propertiesService.findPropertiesNeedingFurnishedDecision.mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ]);
    propertiesService.updateFurnishedFromDecisions.mockResolvedValue([
      { id: 1 },
    ]);

    await expect(job.run()).resolves.toEqual({
      status: 'completed',
      metadataUpdated: 2,
      furnishedDecided: 1,
    });
  });

  it('run() is skipped while a previous run is still in progress', async () => {
    let release: () => void = () => undefined;
    propertiesService.findPropertiesNeedingAiMetadata.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = job.run();
    await expect(job.run()).resolves.toEqual({
      status: 'skipped',
      reason: 'already running',
    });

    release();
    await first;
  });
});
