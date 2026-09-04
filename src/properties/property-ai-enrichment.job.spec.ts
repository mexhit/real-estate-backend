import { Logger } from '@nestjs/common';
import { PropertyAiEnrichmentJob } from './property-ai-enrichment.job';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

describe('PropertyAiEnrichmentJob', () => {
  let job: PropertyAiEnrichmentJob;
  let propertiesService: {
    findPropertiesNeedingAiMetadata: jest.Mock;
    updatePropertiesFromAi: jest.Mock;
  };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    propertiesService = {
      findPropertiesNeedingAiMetadata: jest.fn(),
      updatePropertiesFromAi: jest.fn(),
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
});
