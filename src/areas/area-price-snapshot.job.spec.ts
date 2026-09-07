import { Logger } from '@nestjs/common';
import { AreaPriceSnapshotJob } from './area-price-snapshot.job';
import { AreasService } from './areas.service';
import { AreaPriceSnapshotsService } from './area-price-snapshots.service';
import { Area } from './area.entity';

describe('AreaPriceSnapshotJob', () => {
  let job: AreaPriceSnapshotJob;
  let areasService: { listActive: jest.Mock };
  let areaPriceSnapshotsService: { computeSnapshotForArea: jest.Mock };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    areasService = { listActive: jest.fn() };
    areaPriceSnapshotsService = { computeSnapshotForArea: jest.fn() };

    job = new AreaPriceSnapshotJob(
      areasService as unknown as AreasService,
      areaPriceSnapshotsService as unknown as AreaPriceSnapshotsService,
    );
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('calls the service once per active Area', async () => {
    const areas = [{ id: 1 }, { id: 2 }] as Area[];
    areasService.listActive.mockResolvedValue(areas);
    areaPriceSnapshotsService.computeSnapshotForArea.mockResolvedValue(
      undefined,
    );

    await job.computeWeeklySnapshots();

    expect(
      areaPriceSnapshotsService.computeSnapshotForArea,
    ).toHaveBeenCalledTimes(2);
    expect(
      areaPriceSnapshotsService.computeSnapshotForArea,
    ).toHaveBeenCalledWith(areas[0]);
    expect(
      areaPriceSnapshotsService.computeSnapshotForArea,
    ).toHaveBeenCalledWith(areas[1]);
  });

  it('does not let one Area throwing prevent the others from being processed', async () => {
    const areas = [{ id: 1 }, { id: 2 }] as Area[];
    areasService.listActive.mockResolvedValue(areas);
    areaPriceSnapshotsService.computeSnapshotForArea
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await job.computeWeeklySnapshots();

    expect(
      areaPriceSnapshotsService.computeSnapshotForArea,
    ).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to compute Area price snapshot for Area 1',
      expect.stringContaining('boom'),
    );
  });

  it('does nothing when there are no active Areas', async () => {
    areasService.listActive.mockResolvedValue([]);

    await job.computeWeeklySnapshots();

    expect(
      areaPriceSnapshotsService.computeSnapshotForArea,
    ).not.toHaveBeenCalled();
  });
});
