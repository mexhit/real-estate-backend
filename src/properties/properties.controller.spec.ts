import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let propertiesService: {
    getProperties: jest.Mock;
    queueCreateProperties: jest.Mock;
    updatePropertyFromAi: jest.Mock;
    getNewPropertiesSeries: jest.Mock;
  };

  beforeEach(async () => {
    propertiesService = {
      getProperties: jest.fn(),
      queueCreateProperties: jest.fn(),
      updatePropertyFromAi: jest.fn(),
      getNewPropertiesSeries: jest.fn(),
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

  it('acknowledges bulk create payloads and queues them for processing', async () => {
    const properties = [
      {
        providerId: 'provider-1',
        title: 'Property 1',
        url: 'https://example.com/property/1',
        description: 'Description 1',
        price: '100000 EUR',
      },
      {
        providerId: 'provider-2',
        title: 'Property 2',
        url: 'https://example.com/property/2',
        description: 'Description 2',
        price: '200000 EUR',
      },
    ];

    propertiesService.queueCreateProperties.mockReturnValue(undefined);

    const response = await controller.createProperties(properties as any);

    expect(propertiesService.queueCreateProperties).toHaveBeenCalledWith(
      properties,
    );
    expect(response).toEqual({
      accepted: true,
      count: 2,
    });
  });

  it('passes the property id to the AI metadata update service method', async () => {
    const property = {
      id: 5,
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
      propertyType: 'APARTMENT_2_1',
    };

    propertiesService.updatePropertyFromAi.mockResolvedValue(property);

    await expect(controller.updatePropertyFromAi(5)).resolves.toBe(property);
    expect(propertiesService.updatePropertyFromAi).toHaveBeenCalledWith(5);
  });

  it('returns the dedicated New Property analytics series', async () => {
    const series = [{ date: '2026-08-19', count: 3 }];
    propertiesService.getNewPropertiesSeries.mockResolvedValue(series);

    await expect(controller.getNewPropertiesSeries()).resolves.toBe(series);
    expect(propertiesService.getNewPropertiesSeries).toHaveBeenCalledTimes(1);
  });
});
