import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let propertiesService: { getProperties: jest.Mock };

  beforeEach(async () => {
    propertiesService = {
      getProperties: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [
        {
          provide: PropertiesService,
          useValue: propertiesService,
        },
      ],
    }).compile();

    controller = module.get<PropertiesController>(PropertiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes a single valid propertyTypes filter to the service', async () => {
    propertiesService.getProperties.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });

    await controller.getProperties(
      1,
      10,
      undefined,
      undefined,
      'false',
      'false',
      'false',
      'APARTMENT_2_1',
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      onlyPriceChanged: false,
      propertyTypes: ['APARTMENT_2_1'],
    });
  });

  it('passes an array of valid propertyTypes filters to the service', async () => {
    propertiesService.getProperties.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });

    await controller.getProperties(
      1,
      10,
      undefined,
      undefined,
      'false',
      'false',
      'false',
      ['APARTMENT_2_1', 'SHOP'],
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      onlyPriceChanged: false,
      propertyTypes: ['APARTMENT_2_1', 'SHOP'],
    });
  });

  it('ignores invalid propertyTypes filters', async () => {
    propertiesService.getProperties.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });

    await controller.getProperties(
      1,
      10,
      undefined,
      undefined,
      'false',
      'false',
      'false',
      ['Apartment', 'Unknown'],
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      onlyPriceChanged: false,
      propertyTypes: undefined,
    });
  });
});
