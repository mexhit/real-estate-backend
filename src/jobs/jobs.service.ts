import { Injectable, NotFoundException } from '@nestjs/common';
import { AreaPriceSnapshotJob } from '../areas/area-price-snapshot.job';
import { PropertyAiEnrichmentJob } from '../properties/property-ai-enrichment.job';
import { RunnableJob } from './runnable-job.interface';

@Injectable()
export class JobsService {
  private readonly jobs: ReadonlyMap<string, RunnableJob>;

  constructor(
    areaPriceSnapshotJob: AreaPriceSnapshotJob,
    propertyAiEnrichmentJob: PropertyAiEnrichmentJob,
  ) {
    this.jobs = new Map<string, RunnableJob>([
      ['area-price-snapshot', areaPriceSnapshotJob],
      ['property-ai-enrichment', propertyAiEnrichmentJob],
    ]);
  }

  async run(name: string): Promise<unknown> {
    const job = this.jobs.get(name);

    if (!job) {
      throw new NotFoundException(`Unknown job "${name}"`);
    }

    return job.run();
  }
}
