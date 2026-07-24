import { Logger } from '@nestjs/common';
import { PropertyAiEnrichmentJob } from './property-ai-enrichment.job';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

describe('PropertyAiEnrichmentJob', () => {
  let job: PropertyAiEnrichmentJob;
  let propertiesService: {
    findPropertiesNeedingAiMetadata: jest.Mock;
    updatePropertyFromAi: jest.Mock;
  };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    propertiesService = {
      findPropertiesNeedingAiMetadata: jest.fn(),
      updatePropertyFromAi: jest.fn(),
    };

    job = new PropertyAiEnrichmentJob(
      propertiesService as unknown as PropertiesService,
    );
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('updates a batch of properties from AI metadata every run', async () => {
    const properties = [{ id: 1 }, { id: 2 }] as Property[];

    propertiesService.findPropertiesNeedingAiMetadata.mockResolvedValue(
      properties,
    );
    propertiesService.updatePropertyFromAi.mockResolvedValue({});

    await job.updatePropertiesFromAi();

    expect(
      propertiesService.findPropertiesNeedingAiMetadata,
    ).toHaveBeenCalledWith(10);
    expect(propertiesService.updatePropertyFromAi).toHaveBeenNthCalledWith(
      1,
      1,
    );
    expect(propertiesService.updatePropertyFromAi).toHaveBeenNthCalledWith(
      2,
      2,
    );
  });

  it('continues processing the batch when one property update fails', async () => {
    const properties = [{ id: 1 }, { id: 2 }] as Property[];

    propertiesService.findPropertiesNeedingAiMetadata.mockResolvedValue(
      properties,
    );
    propertiesService.updatePropertyFromAi
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce({});

    await job.updatePropertiesFromAi();

    expect(propertiesService.updatePropertyFromAi).toHaveBeenNthCalledWith(
      1,
      1,
    );
    expect(propertiesService.updatePropertyFromAi).toHaveBeenNthCalledWith(
      2,
      2,
    );
  });
});
