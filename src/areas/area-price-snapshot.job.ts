import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AreasService } from './areas.service';
import { AreaPriceSnapshotsService } from './area-price-snapshots.service';

@Injectable()
export class AreaPriceSnapshotJob {
  private readonly logger = new Logger(AreaPriceSnapshotJob.name);
  private isRunning = false;

  constructor(
    private readonly areasService: AreasService,
    private readonly areaPriceSnapshotsService: AreaPriceSnapshotsService,
  ) {}

  @Cron('0 3 * * 0')
  async computeWeeklySnapshots(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping Area price snapshot run because it is still running',
      );
      return;
    }

    this.isRunning = true;

    try {
      const areas = await this.areasService.listActive();

      for (const area of areas) {
        try {
          await this.areaPriceSnapshotsService.computeSnapshotForArea(area);
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? (error.stack ?? error.message)
              : String(error);

          this.logger.warn(
            `Failed to compute Area price snapshot for Area ${area.id}`,
            message,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
