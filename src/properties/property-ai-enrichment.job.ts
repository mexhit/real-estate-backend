import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PropertiesService } from './properties.service';
import { RunnableJob } from '../jobs/runnable-job.interface';

const AI_METADATA_BATCH_SIZE = 10;

export type PropertyAiEnrichmentJobResult =
  | { status: 'skipped'; reason: string }
  | {
      status: 'completed';
      metadataUpdated: number;
      furnishedDecided: number;
    };

@Injectable()
export class PropertyAiEnrichmentJob implements RunnableJob {
  private readonly logger = new Logger(PropertyAiEnrichmentJob.name);
  private isRunning = false;

  constructor(private readonly propertiesService: PropertiesService) {}

  @Cron('3-59/5 * * * *')
  async updatePropertiesFromAi(): Promise<void> {
    await this.run();
  }

  async run(): Promise<PropertyAiEnrichmentJobResult> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping AI property enrichment because it is still running',
      );
      return { status: 'skipped', reason: 'already running' };
    }

    this.isRunning = true;

    try {
      const metadataUpdated = await this.enrichMetadata();
      const furnishedDecided = await this.decideFurnished();

      return { status: 'completed', metadataUpdated, furnishedDecided };
    } finally {
      this.isRunning = false;
    }
  }

  private async enrichMetadata(): Promise<number> {
    const properties =
      await this.propertiesService.findPropertiesNeedingAiMetadata(
        AI_METADATA_BATCH_SIZE,
      );

    if (properties.length === 0) {
      return 0;
    }

    try {
      const updated =
        await this.propertiesService.updatePropertiesFromAi(properties);

      return updated.length;
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to update a batch of ${properties.length} properties from AI`,
        this.describeError(error),
      );
      return 0;
    }
  }

  private async decideFurnished(): Promise<number> {
    try {
      const properties =
        await this.propertiesService.findPropertiesNeedingFurnishedDecision(
          AI_METADATA_BATCH_SIZE,
        );

      const decided =
        await this.propertiesService.updateFurnishedFromDecisions(properties);

      return decided.length;
    } catch (error: unknown) {
      this.logger.warn(
        'Failed to decide furnished status for a batch of properties',
        this.describeError(error),
      );
      return 0;
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error
      ? (error.stack ?? error.message)
      : String(error);
  }
}
