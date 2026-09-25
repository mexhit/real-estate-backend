import { Test, TestingModule } from '@nestjs/testing';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { AreaPriceSnapshotsService } from './area-price-snapshots.service';
import { Area } from './area.entity';

describe('AreasController', () => {
  let controller: AreasController;
  let areasService: {
    listActive: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    rename: jest.Mock;
    deleteAndReassign: jest.Mock;
  };
  let areaPriceSnapshotsService: {
    getContributingListings: jest.Mock;
    getContributingListingsDistribution: jest.Mock;
  };

  beforeEach(async () => {
    areasService = {
      listActive: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      rename: jest.fn(),
      deleteAndReassign: jest.fn(),
    };
    areaPriceSnapshotsService = {
      getContributingListings: jest.fn(),
      getContributingListingsDistribution: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AreasController],
      providers: [
        {
          provide: AreasService,
          useValue: areasService,
        },
        {
          provide: AreaPriceSnapshotsService,
          useValue: areaPriceSnapshotsService,
        },
      ],
    }).compile();

    controller = module.get<AreasController>(AreasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates listing to AreasService', async () => {
    const areas = [{ id: 1, name: 'Blloku' }] as Area[];
    areasService.listActive.mockResolvedValue(areas);

    await expect(controller.listActive()).resolves.toBe(areas);
    expect(areasService.listActive).toHaveBeenCalledTimes(1);
  });

  it('delegates getting one Area to AreasService', async () => {
    const area = { id: 1, name: 'Blloku' } as Area;
    areasService.findOne.mockResolvedValue(area);

    await expect(controller.findOne(1)).resolves.toBe(area);
    expect(areasService.findOne).toHaveBeenCalledWith(1);
  });

  it('delegates creating an Area to AreasService', async () => {
    const area = { id: 1, name: 'Blloku' } as Area;
    areasService.create.mockResolvedValue(area);

    await expect(controller.create('Blloku')).resolves.toBe(area);
    expect(areasService.create).toHaveBeenCalledWith('Blloku');
  });

  it('delegates renaming an Area to AreasService', async () => {
    const area = { id: 1, name: 'Blloku' } as Area;
    areasService.rename.mockResolvedValue(area);

    await expect(controller.rename(1, 'Blloku')).resolves.toBe(area);
    expect(areasService.rename).toHaveBeenCalledWith(1, 'Blloku');
  });

  it('delegates delete-and-reassign to AreasService', async () => {
    areasService.deleteAndReassign.mockResolvedValue(undefined);

    await controller.deleteAndReassign(1, 2);
    expect(areasService.deleteAndReassign).toHaveBeenCalledWith(1, 2);
  });

  it('delegates fetching Contributing Listings to AreaPriceSnapshotsService, clamping page/limit', async () => {
    const result = { data: [], total: 0, page: 1, limit: 10, totalPages: 1 };
    areaPriceSnapshotsService.getContributingListings.mockResolvedValue(
      result,
    );

    await expect(
      controller.getContributingListings(1, 0, 500),
    ).resolves.toBe(result);
    expect(
      areaPriceSnapshotsService.getContributingListings,
    ).toHaveBeenCalledWith(1, 1, 100, undefined, {
      min: undefined,
      max: undefined,
    });
  });

  it('delegates fetching the Contributing Listings distribution to AreaPriceSnapshotsService', async () => {
    const result = { avgPricePerSqm: null, avgPriceCurrency: null, listings: [] };
    areaPriceSnapshotsService.getContributingListingsDistribution.mockResolvedValue(
      result,
    );

    await expect(
      controller.getContributingListingsDistribution(1),
    ).resolves.toBe(result);
    expect(
      areaPriceSnapshotsService.getContributingListingsDistribution,
    ).toHaveBeenCalledWith(1);
  });

  it('passes highlightProviderId through to AreaPriceSnapshotsService', async () => {
    const result = { data: [], total: 0, page: 1, limit: 10, totalPages: 1 };
    areaPriceSnapshotsService.getContributingListings.mockResolvedValue(
      result,
    );

    await controller.getContributingListings(1, 1, 10, 'provider-1');
    expect(
      areaPriceSnapshotsService.getContributingListings,
    ).toHaveBeenCalledWith(1, 1, 10, 'provider-1', {
      min: undefined,
      max: undefined,
    });
  });

  it('parses the price/m² range and passes it through to AreaPriceSnapshotsService', async () => {
    areaPriceSnapshotsService.getContributingListings.mockResolvedValue({});

    await controller.getContributingListings(
      1,
      1,
      10,
      undefined,
      '1500',
      '1750',
    );
    expect(
      areaPriceSnapshotsService.getContributingListings,
    ).toHaveBeenCalledWith(1, 1, 10, undefined, { min: 1500, max: 1750 });
  });
});
