import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PropertiesService } from './properties.service';

const AI_METADATA_BATCH_SIZE = 10;

@Injectable()
export class PropertyAiEnrichmentJob {
  private readonly logger = new Logger(PropertyAiEnrichmentJob.name);
  private isRunning = false;

  constructor(private readonly propertiesService: PropertiesService) {}

  @Cron('3-59/5 * * * *')
  async updatePropertiesFromAi(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping AI property enrichment because it is still running',
      );
      return;
    }

    this.isRunning = true;

    try {
      await this.enrichMetadata();
      await this.decideFurnished();
    } finally {
      this.isRunning = false;
    }
  }

  private async enrichMetadata(): Promise<void> {
    const properties =
      await this.propertiesService.findPropertiesNeedingAiMetadata(
        AI_METADATA_BATCH_SIZE,
      );

    if (properties.length === 0) {
      return;
    }

    try {
      await this.propertiesService.updatePropertiesFromAi(properties);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to update a batch of ${properties.length} properties from AI`,
        this.describeError(error),
      );
    }
  }

  private async decideFurnished(): Promise<void> {
    try {
      const properties =
        await this.propertiesService.findPropertiesNeedingFurnishedDecision(
          AI_METADATA_BATCH_SIZE,
        );

      await this.propertiesService.updateFurnishedFromDecisions(properties);
    } catch (error: unknown) {
      this.logger.warn(
        'Failed to decide furnished status for a batch of properties',
        this.describeError(error),
      );
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error
      ? (error.stack ?? error.message)
      : String(error);
  }
}
