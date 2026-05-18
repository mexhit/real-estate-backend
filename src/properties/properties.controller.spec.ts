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

  it('passes a valid propertyType filter to the service', async () => {
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
      propertyType: 'APARTMENT_2_1',
    });
  });

  it('ignores an invalid propertyType filter', async () => {
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
      'Apartment',
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      onlyPriceChanged: false,
      propertyType: undefined,
    });
  });
});
