import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AreasService } from './areas.service';
import { AreaPriceSnapshotsService } from './area-price-snapshots.service';
import { RunnableJob } from '../jobs/runnable-job.interface';

export interface AreaSnapshotRunResult {
  areaId: number;
  areaName: string;
  propertyCount?: number;
  excludedCount?: number;
  error?: string;
}

export type AreaPriceSnapshotJobResult =
  | { status: 'skipped'; reason: string }
  | { status: 'completed'; areas: AreaSnapshotRunResult[] };

@Injectable()
export class AreaPriceSnapshotJob implements RunnableJob {
  private readonly logger = new Logger(AreaPriceSnapshotJob.name);
  private isRunning = false;

  constructor(
    private readonly areasService: AreasService,
    private readonly areaPriceSnapshotsService: AreaPriceSnapshotsService,
  ) {}

  @Cron('0 3 * * 0')
  async computeWeeklySnapshots(): Promise<void> {
    await this.run();
  }

  async run(): Promise<AreaPriceSnapshotJobResult> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping Area price snapshot run because it is still running',
      );
      return { status: 'skipped', reason: 'already running' };
    }

    this.isRunning = true;

    const results: AreaSnapshotRunResult[] = [];

    try {
      const areas = await this.areasService.listActive();

      for (const area of areas) {
        try {
          const snapshot =
            await this.areaPriceSnapshotsService.computeSnapshotForArea(
              area,
            );

          results.push({
            areaId: area.id,
            areaName: area.name,
            propertyCount: snapshot.propertyCount,
            excludedCount: snapshot.excludedCount,
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? (error.stack ?? error.message)
              : String(error);

          this.logger.warn(
            `Failed to compute Area price snapshot for Area ${area.id}`,
            message,
          );

          results.push({
            areaId: area.id,
            areaName: area.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      this.isRunning = false;
    }

    return { status: 'completed', areas: results };
  }
}
