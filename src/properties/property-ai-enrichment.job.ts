import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PropertiesService } from './properties.service';

const AI_METADATA_BATCH_SIZE = 10;

@Injectable()
export class PropertyAiEnrichmentJob {
  private readonly logger = new Logger(PropertyAiEnrichmentJob.name);
  private isRunning = false;

  constructor(private readonly propertiesService: PropertiesService) {}

  @Cron('*/5 * * * *')
  async updatePropertiesFromAi(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping AI property enrichment because it is still running',
      );
      return;
    }

    this.isRunning = true;

    try {
      const properties =
        await this.propertiesService.findPropertiesNeedingAiMetadata(
          AI_METADATA_BATCH_SIZE,
        );

      for (const property of properties) {
        try {
          await this.propertiesService.updatePropertyFromAi(property.id);
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? (error.stack ?? error.message)
              : String(error);

          this.logger.warn(
            `Failed to update property ${property.id} from AI`,
            message,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
