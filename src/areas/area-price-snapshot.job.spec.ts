import { Logger } from '@nestjs/common';
import { AreaPriceSnapshotJob } from './area-price-snapshot.job';
import { AreasService } from './areas.service';
import { AreaPriceSnapshotsService } from './area-price-snapshots.service';
import { Area } from './area.entity';
import { AreaPriceSnapshot } from './area-price-snapshot.entity';

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

  function snapshot(
    overrides: Partial<AreaPriceSnapshot> = {},
  ): AreaPriceSnapshot {
    return {
      id: 1,
      areaId: 1,
      ranAt: new Date(),
      avgPricePerSqm: 1000,
      currency: 'EUR',
      propertyCount: 5,
      excludedCount: 1,
      ...overrides,
    } as AreaPriceSnapshot;
  }

  it('calls the service once per active Area and reports per-area results', async () => {
    const areas = [
      { id: 1, name: 'Blloku' },
      { id: 2, name: 'Tirana e Re' },
    ] as Area[];
    areasService.listActive.mockResolvedValue(areas);
    areaPriceSnapshotsService.computeSnapshotForArea
      .mockResolvedValueOnce(snapshot({ propertyCount: 5, excludedCount: 1 }))
      .mockResolvedValueOnce(snapshot({ propertyCount: 3, excludedCount: 0 }));

    const result = await job.run();

    expect(
      areaPriceSnapshotsService.computeSnapshotForArea,
    ).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: 'completed',
      areas: [
        { areaId: 1, areaName: 'Blloku', propertyCount: 5, excludedCount: 1 },
        {
          areaId: 2,
          areaName: 'Tirana e Re',
          propertyCount: 3,
          excludedCount: 0,
        },
      ],
    });
  });

  it('does not let one Area throwing prevent the others from being processed', async () => {
    const areas = [
      { id: 1, name: 'Blloku' },
      { id: 2, name: 'Tirana e Re' },
    ] as Area[];
    areasService.listActive.mockResolvedValue(areas);
    areaPriceSnapshotsService.computeSnapshotForArea
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(snapshot({ propertyCount: 3, excludedCount: 0 }));

    const result = await job.run();

    expect(
      areaPriceSnapshotsService.computeSnapshotForArea,
    ).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to compute Area price snapshot for Area 1',
      expect.stringContaining('boom'),
    );
    expect(result).toEqual({
      status: 'completed',
      areas: [
        { areaId: 1, areaName: 'Blloku', error: 'boom' },
        {
          areaId: 2,
          areaName: 'Tirana e Re',
          propertyCount: 3,
          excludedCount: 0,
        },
      ],
    });
  });

  it('does nothing when there are no active Areas', async () => {
    areasService.listActive.mockResolvedValue([]);

    const result = await job.run();

    expect(
      areaPriceSnapshotsService.computeSnapshotForArea,
    ).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'completed', areas: [] });
  });

  it('skips the run when a run is already in progress', async () => {
    let resolveListActive!: (areas: Area[]) => void;
    areasService.listActive.mockImplementation(
      () =>
        new Promise<Area[]>((resolve) => {
          resolveListActive = resolve;
        }),
    );

    const firstRun = job.run();
    const secondRun = await job.run();

    expect(secondRun).toEqual({
      status: 'skipped',
      reason: 'already running',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Skipping Area price snapshot run because it is still running',
    );

    resolveListActive([]);
    await firstRun;
  });

  it('computeWeeklySnapshots delegates to run()', async () => {
    areasService.listActive.mockResolvedValue([]);

    await job.computeWeeklySnapshots();

    expect(areasService.listActive).toHaveBeenCalledTimes(1);
  });
});
