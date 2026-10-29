import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let propertiesService: {
    getProperties: jest.Mock;
    queueCreateProperties: jest.Mock;
    updatePropertyFromAi: jest.Mock;
    updateProperty: jest.Mock;
    getNewPropertiesSeries: jest.Mock;
    getAreaDistribution: jest.Mock;
  };

  beforeEach(async () => {
    propertiesService = {
      getProperties: jest.fn(),
      queueCreateProperties: jest.fn(),
      updatePropertyFromAi: jest.fn(),
      updateProperty: jest.fn(),
      getNewPropertiesSeries: jest.fn(),
      getAreaDistribution: jest.fn(),
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
      'false',
      'false',
      'false',
      'APARTMENT_2_1',
      undefined,
      undefined,
      undefined,
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      hideDismissed: false,
      onlyPriceChanged: false,
      onlyUntyped: false,
      onlyUnresolved: false,
      propertyTypes: ['APARTMENT_2_1'],
      areaIds: undefined,
      sources: undefined,
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
      'false',
      'false',
      'false',
      ['APARTMENT_2_1', 'SHOP'],
      undefined,
      undefined,
      undefined,
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      hideDismissed: false,
      onlyPriceChanged: false,
      onlyUntyped: false,
      onlyUnresolved: false,
      propertyTypes: ['APARTMENT_2_1', 'SHOP'],
      areaIds: undefined,
      sources: undefined,
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
      'false',
      'false',
      'false',
      ['Apartment', 'Unknown'],
      undefined,
      undefined,
      undefined,
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      hideDismissed: false,
      onlyPriceChanged: false,
      onlyUntyped: false,
      onlyUnresolved: false,
      propertyTypes: undefined,
      areaIds: undefined,
      sources: undefined,
    });
  });

  it('passes an array of areaIds filters to the service', async () => {
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
      'false',
      'false',
      'false',
      undefined,
      ['3', '5'],
      undefined,
      undefined,
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      hideDismissed: false,
      onlyPriceChanged: false,
      onlyUntyped: false,
      onlyUnresolved: false,
      propertyTypes: undefined,
      areaIds: [3, 5],
      sources: undefined,
    });
  });

  it('ignores non-numeric areaIds filters', async () => {
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
      'false',
      'false',
      'false',
      undefined,
      ['abc'],
      undefined,
      undefined,
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      hideDismissed: false,
      onlyPriceChanged: false,
      onlyUntyped: false,
      onlyUnresolved: false,
      propertyTypes: undefined,
      areaIds: undefined,
      sources: undefined,
    });
  });

  it('passes an array of valid sources filters to the service', async () => {
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
      'false',
      'false',
      'false',
      undefined,
      undefined,
      ['duashpi', 'gazetacelesi', 'century21'],
      undefined,
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(1, 10, {
      fromDate: undefined,
      toDate: undefined,
      onlyUnseen: false,
      onlyBookmarked: false,
      hideDismissed: false,
      onlyPriceChanged: false,
      onlyUntyped: false,
      onlyUnresolved: false,
      propertyTypes: undefined,
      areaIds: undefined,
      sources: ['duashpi', 'gazetacelesi', 'century21'],
    });
  });

  it('passes the isFurnished filter to the service as a boolean', async () => {
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
      'false',
      'false',
      'false',
      undefined,
      undefined,
      undefined,
      'true',
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(
      1,
      10,
      expect.objectContaining({ isFurnished: true }),
    );
  });

  it('rejects an unrecognized source filter value', async () => {
    await expect(
      controller.getProperties(
        1,
        10,
        undefined,
        undefined,
        'false',
        'false',
        'false',
        'false',
        'false',
        'false',
        undefined,
        undefined,
        'not-a-real-source',
        undefined,
      ),
    ).rejects.toThrow('Invalid source: not-a-real-source');

    expect(propertiesService.getProperties).not.toHaveBeenCalled();
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

  it('passes the id, body, and current user id to the manual update service method', async () => {
    const property = { id: 5, title: 'New title' };
    propertiesService.updateProperty.mockResolvedValue(property);

    const request = { user: { id: 42 } } as any;
    const updates = { title: 'New title' };

    await expect(controller.updateProperty(5, updates, request)).resolves.toBe(
      property,
    );
    expect(propertiesService.updateProperty).toHaveBeenCalledWith(
      5,
      updates,
      42,
    );
  });

  it('returns the dedicated New Property analytics series', async () => {
    const series = [{ date: '2026-08-19', count: 3 }];
    propertiesService.getNewPropertiesSeries.mockResolvedValue(series);

    await expect(controller.getNewPropertiesSeries()).resolves.toBe(series);
    expect(propertiesService.getNewPropertiesSeries).toHaveBeenCalledTimes(1);
  });

  it('passes the date range to the Area Distribution analytics', async () => {
    const distribution = [{ areaId: 1, name: 'Blloku', count: 3 }];
    propertiesService.getAreaDistribution.mockResolvedValue(distribution);

    await expect(
      controller.getAreaDistribution('1700000000000', '1700086400000'),
    ).resolves.toBe(distribution);
    expect(propertiesService.getAreaDistribution).toHaveBeenCalledWith(
      new Date(1700000000000),
      new Date(1700086400000),
    );
  });
  it('forwards the raw search string to the service without normalizing it', async () => {
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
      'false',
      'false',
      'false',
      undefined,
      undefined,
      undefined,
      undefined,
      '  Çelësi   ballkon ',
    );

    expect(propertiesService.getProperties).toHaveBeenCalledWith(
      1,
      10,
      expect.objectContaining({ search: '  Çelësi   ballkon ' }),
    );
  });

  it('forwards no search when it is omitted', async () => {
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
      'false',
      'false',
      'false',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    const filters = propertiesService.getProperties.mock.calls[0][2];
    expect(filters.search).toBeUndefined();
  });
});
