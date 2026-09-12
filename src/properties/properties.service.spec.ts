import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Not } from 'typeorm';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';
import { PropertyEditHistory } from './property-edit-history.entity';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';
import { AreasService } from '../areas/areas.service';
import { Area } from '../areas/area.entity';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let repository: {
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
    query: jest.Mock;
    update: jest.Mock;
  };
  let editHistoryRepository: { insert: jest.Mock };
  let extractionService: { extract: jest.Mock; extractMany: jest.Mock };
  let areasService: {
    listActiveNames: jest.Mock;
    findOrCreate: jest.Mock;
    findOne: jest.Mock;
  };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    repository = {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
    };
    editHistoryRepository = {
      insert: jest.fn(),
    };
    extractionService = {
      extract: jest.fn(),
      extractMany: jest.fn(),
    };
    areasService = {
      listActiveNames: jest.fn().mockResolvedValue([]),
      findOrCreate: jest.fn(),
      findOne: jest.fn(),
    };
    configService = {
      get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: getRepositoryToken(Property),
          useValue: repository,
        },
        {
          provide: getRepositoryToken(PropertyEditHistory),
          useValue: editHistoryRepository,
        },
        {
          provide: PropertyMetadataExtractionService,
          useValue: extractionService,
        },
        {
          provide: AreasService,
          useValue: areasService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('enriches raw properties before saving them', async () => {
    const property = {
      providerId: 'provider-1',
      title: 'Apartment 85m2',
      url: 'https://example.com/property/1',
      description: 'Two bedroom apartment, 85 m2, EUR 120000',
      price: '120000 EUR',
    } as Property;

    extractionService.extract.mockResolvedValue({
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
      propertyType: 'APARTMENT_2_1',
    });
    repository.save.mockImplementation(async (payload) => payload);

    const saved = await service.createProperty(property);

    expect(extractionService.extract).toHaveBeenCalledWith(property, []);
    expect(repository.save).toHaveBeenCalledWith({
      ...property,
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
      propertyType: 'APARTMENT_2_1',
      areaId: null,
      aiResponseError: null,
      aiMetadataUpdatedAt: expect.any(Date),
    });
    expect(saved).toMatchObject({
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
      propertyType: 'APARTMENT_2_1',
      aiResponseError: null,
      aiMetadataUpdatedAt: expect.any(Date),
    });
  });

  it('keeps explicit normalized values from the incoming payload', async () => {
    const property = {
      providerId: 'provider-2',
      title: 'Apartment',
      url: 'https://example.com/property/2',
      description: 'Description',
      price: 'raw',
      priceAmount: 95000,
      priceCurrency: 'EUR',
      squareMeters: 72,
      propertyType: 'VILLA',
    } as Property;

    extractionService.extract.mockResolvedValue({
      priceAmount: 120000,
      priceCurrency: 'USD',
      squareMeters: 85,
      propertyType: 'APARTMENT_3_1',
    });
    repository.save.mockImplementation(async (payload) => payload);

    const saved = await service.createProperty(property);

    expect(repository.save).toHaveBeenCalledWith({
      ...property,
      areaId: null,
      aiResponseError: null,
      aiMetadataUpdatedAt: expect.any(Date),
    });
    expect(saved).toMatchObject({
      priceAmount: 95000,
      priceCurrency: 'EUR',
      squareMeters: 72,
      propertyType: 'VILLA',
      aiResponseError: null,
      aiMetadataUpdatedAt: expect.any(Date),
    });
  });

  it('resolves the extracted areaName into an areaId before saving', async () => {
    const property = {
      providerId: 'provider-4',
      title: 'Apartment in Blloku',
      url: 'https://example.com/property/4',
      description: 'Description',
      price: '100000 EUR',
    } as Property;

    areasService.listActiveNames.mockResolvedValue(['Blloku']);
    extractionService.extract.mockResolvedValue({
      priceAmount: 100000,
      priceCurrency: 'EUR',
      squareMeters: 60,
      propertyType: 'APARTMENT_2_1',
      areaName: 'Blloku',
    });
    areasService.findOrCreate.mockResolvedValue({
      id: 7,
      name: 'Blloku',
    } as Area);
    repository.save.mockImplementation(async (payload) => payload);

    const saved = await service.createProperty(property);

    expect(extractionService.extract).toHaveBeenCalledWith(property, [
      'Blloku',
    ]);
    expect(areasService.findOrCreate).toHaveBeenCalledWith('Blloku');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ areaId: 7 }),
    );
    expect(saved).toMatchObject({ areaId: 7 });
  });

  it('respects an already-set incoming areaId over the extracted one', async () => {
    const property = {
      providerId: 'provider-5',
      title: 'Apartment in Blloku',
      url: 'https://example.com/property/5',
      description: 'Description',
      price: '100000 EUR',
      areaId: 3,
    } as Property;

    extractionService.extract.mockResolvedValue({
      priceAmount: 100000,
      priceCurrency: 'EUR',
      squareMeters: 60,
      propertyType: 'APARTMENT_2_1',
      areaName: 'Blloku',
    });
    repository.save.mockImplementation(async (payload) => payload);

    const saved = await service.createProperty(property);

    expect(areasService.findOrCreate).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ areaId: 3 }),
    );
    expect(saved).toMatchObject({ areaId: 3 });
  });

  it('saves the property and records the AI error when extraction fails', async () => {
    const property = {
      providerId: 'provider-3',
      title: 'Apartment',
      url: 'https://example.com/property/3',
      description: 'Description',
      price: '100000 EUR',
    } as Property;

    extractionService.extract.mockRejectedValue(new Error('AI timeout'));
    repository.save.mockImplementation(async (payload) => payload);

    const saved = await service.createProperty(property);

    expect(repository.save).toHaveBeenCalledWith({
      ...property,
      priceAmount: null,
      priceCurrency: null,
      squareMeters: null,
      propertyType: null,
      areaId: null,
      aiResponseError: expect.stringContaining('AI timeout'),
      aiMetadataUpdatedAt: expect.any(Date),
    });
    expect(saved).toMatchObject({
      aiResponseError: expect.stringContaining('AI timeout'),
      aiMetadataUpdatedAt: expect.any(Date),
    });
  });

  describe('createProperties', () => {
    it('extracts metadata for the whole batch in one call and saves each property', async () => {
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
      ] as Property[];

      extractionService.extractMany.mockResolvedValue([
        {
          priceAmount: 100000,
          priceCurrency: 'EUR',
          squareMeters: 50,
          propertyType: 'APARTMENT_1_1',
          areaName: null,
        },
        {
          priceAmount: 200000,
          priceCurrency: 'EUR',
          squareMeters: 90,
          propertyType: 'APARTMENT_2_1',
          areaName: null,
        },
      ]);
      repository.save.mockImplementation(async (payload) => payload);

      const created = await service.createProperties(properties);

      expect(extractionService.extractMany).toHaveBeenCalledTimes(1);
      expect(extractionService.extractMany).toHaveBeenCalledWith(
        properties,
        [],
      );
      expect(created).toMatchObject([
        { priceAmount: 100000, propertyType: 'APARTMENT_1_1' },
        { priceAmount: 200000, propertyType: 'APARTMENT_2_1' },
      ]);
    });

    it('splits a large batch into chunks of the configured AI chunk size', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: string) =>
          key === 'BULK_CREATE_AI_CHUNK_SIZE' ? '2' : defaultValue,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PropertiesService,
          { provide: getRepositoryToken(Property), useValue: repository },
          {
            provide: getRepositoryToken(PropertyEditHistory),
            useValue: editHistoryRepository,
          },
          {
            provide: PropertyMetadataExtractionService,
            useValue: extractionService,
          },
          { provide: AreasService, useValue: areasService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const chunkedService = module.get<PropertiesService>(PropertiesService);

      const properties = [1, 2, 3].map(
        (n) =>
          ({
            providerId: `provider-${n}`,
            title: `Property ${n}`,
            url: `https://example.com/property/${n}`,
            description: `Description ${n}`,
            price: '100000 EUR',
          }) as Property,
      );

      extractionService.extractMany.mockResolvedValue([
        {
          priceAmount: null,
          priceCurrency: null,
          squareMeters: null,
          propertyType: null,
          areaName: null,
        },
        {
          priceAmount: null,
          priceCurrency: null,
          squareMeters: null,
          propertyType: null,
          areaName: null,
        },
      ]);
      repository.save.mockImplementation(async (payload) => payload);

      await chunkedService.createProperties(properties);

      expect(extractionService.extractMany).toHaveBeenCalledTimes(2);
      expect(extractionService.extractMany).toHaveBeenNthCalledWith(
        1,
        properties.slice(0, 2),
        [],
      );
      expect(extractionService.extractMany).toHaveBeenNthCalledWith(
        2,
        properties.slice(2),
        [],
      );
    });

    it('records the same AI error on every property when batch extraction fails', async () => {
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
      ] as Property[];

      extractionService.extractMany.mockRejectedValue(
        new Error('AI batch timeout'),
      );
      repository.save.mockImplementation(async (payload) => payload);

      const created = await service.createProperties(properties);

      expect(created).toMatchObject([
        {
          priceAmount: null,
          aiResponseError: expect.stringContaining('AI batch timeout'),
        },
        {
          priceAmount: null,
          aiResponseError: expect.stringContaining('AI batch timeout'),
        },
      ]);
    });

    it('returns an empty array without calling the extraction service', async () => {
      const created = await service.createProperties([]);

      expect(created).toEqual([]);
      expect(extractionService.extractMany).not.toHaveBeenCalled();
    });
  });

  it('updates an existing property with AI metadata', async () => {
    const property = {
      id: 10,
      providerId: 'provider-10',
      title: 'Villa',
      url: 'https://example.com/property/10',
      description: 'Villa, 180 m2, EUR 450000',
      price: '450000 EUR',
      priceAmount: null,
      priceCurrency: null,
      squareMeters: null,
      propertyType: null,
      aiResponseError: 'previous error',
    } as Property;

    repository.findOne.mockResolvedValue(property);
    extractionService.extract.mockResolvedValue({
      priceAmount: 450000,
      priceCurrency: 'EUR',
      squareMeters: 180,
      propertyType: 'VILLA',
    });
    repository.save.mockImplementation(async (payload) => payload);

    const updated = await service.updatePropertyFromAi(10);

    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(extractionService.extract).toHaveBeenCalledWith(property, []);
    expect(repository.save).toHaveBeenCalledWith({
      ...property,
      priceAmount: 450000,
      priceCurrency: 'EUR',
      squareMeters: 180,
      propertyType: 'VILLA',
      areaId: null,
      aiResponseError: null,
      aiMetadataUpdatedAt: expect.any(Date),
    });
    expect(updated).toMatchObject({
      priceAmount: 450000,
      priceCurrency: 'EUR',
      squareMeters: 180,
      propertyType: 'VILLA',
      aiResponseError: null,
      aiMetadataUpdatedAt: expect.any(Date),
    });
  });

  it('resolves the extracted areaName into an areaId when updating from AI', async () => {
    const property = {
      id: 12,
      providerId: 'provider-12',
      title: 'Apartment in Tirana e Re',
      url: 'https://example.com/property/12',
      description: 'Description',
      price: '100000 EUR',
    } as Property;

    repository.findOne.mockResolvedValue(property);
    areasService.listActiveNames.mockResolvedValue(['Tirana e Re']);
    extractionService.extract.mockResolvedValue({
      priceAmount: 100000,
      priceCurrency: 'EUR',
      squareMeters: 60,
      propertyType: 'APARTMENT_2_1',
      areaName: 'Tirana e Re',
    });
    areasService.findOrCreate.mockResolvedValue({
      id: 9,
      name: 'Tirana e Re',
    } as Area);
    repository.save.mockImplementation(async (payload) => payload);

    const updated = await service.updatePropertyFromAi(12);

    expect(extractionService.extract).toHaveBeenCalledWith(property, [
      'Tirana e Re',
    ]);
    expect(areasService.findOrCreate).toHaveBeenCalledWith('Tirana e Re');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ areaId: 9 }),
    );
    expect(updated).toMatchObject({ areaId: 9 });
  });

  it('throws when updating AI metadata for a missing property', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.updatePropertyFromAi(404)).rejects.toThrow(
      'Property with id 404 not found',
    );
    expect(extractionService.extract).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('records the AI error when updating an existing property fails', async () => {
    const property = {
      id: 11,
      providerId: 'provider-11',
      title: 'Apartment',
      url: 'https://example.com/property/11',
      description: 'Description',
      price: '100000 EUR',
      priceAmount: 100000,
      priceCurrency: 'EUR',
      squareMeters: 70,
      propertyType: 'APARTMENT_2_1',
      aiResponseError: null,
    } as Property;

    repository.findOne.mockResolvedValue(property);
    extractionService.extract.mockRejectedValue(new Error('AI timeout'));
    repository.save.mockImplementation(async (payload) => payload);

    const updated = await service.updatePropertyFromAi(11);

    expect(repository.save).toHaveBeenCalledWith({
      ...property,
      aiResponseError: expect.stringContaining('AI timeout'),
      aiMetadataUpdatedAt: expect.any(Date),
    });
    expect(updated).toMatchObject({
      priceAmount: 100000,
      priceCurrency: 'EUR',
      squareMeters: 70,
      propertyType: 'APARTMENT_2_1',
      aiResponseError: expect.stringContaining('AI timeout'),
      aiMetadataUpdatedAt: expect.any(Date),
    });
  });

  describe('updatePropertiesFromAi', () => {
    it('extracts metadata for the whole batch in one call and saves each property', async () => {
      const properties = [
        {
          id: 1,
          providerId: 'provider-1',
          title: 'Apartment',
          url: 'https://example.com/property/1',
          description: 'Description',
          price: '100000 EUR',
        },
        {
          id: 2,
          providerId: 'provider-2',
          title: 'Villa',
          url: 'https://example.com/property/2',
          description: 'Description',
          price: '450000 EUR',
        },
      ] as Property[];

      extractionService.extractMany.mockResolvedValue([
        {
          priceAmount: 100000,
          priceCurrency: 'EUR',
          squareMeters: 60,
          propertyType: 'APARTMENT_2_1',
          areaName: null,
        },
        {
          priceAmount: 450000,
          priceCurrency: 'EUR',
          squareMeters: 180,
          propertyType: 'VILLA',
          areaName: null,
        },
      ]);
      repository.save.mockImplementation(async (payload) => payload);

      const updated = await service.updatePropertiesFromAi(properties);

      expect(extractionService.extractMany).toHaveBeenCalledTimes(1);
      expect(extractionService.extractMany).toHaveBeenCalledWith(
        properties,
        [],
      );
      expect(updated).toMatchObject([
        {
          id: 1,
          priceAmount: 100000,
          propertyType: 'APARTMENT_2_1',
          aiResponseError: null,
        },
        {
          id: 2,
          priceAmount: 450000,
          propertyType: 'VILLA',
          aiResponseError: null,
        },
      ]);
    });

    it('records the same AI error on every property when batch extraction fails', async () => {
      const properties = [
        {
          id: 1,
          providerId: 'provider-1',
          title: 'Apartment',
          url: 'https://example.com/property/1',
          description: 'Description',
          price: '100000 EUR',
          priceAmount: null,
        },
        {
          id: 2,
          providerId: 'provider-2',
          title: 'Villa',
          url: 'https://example.com/property/2',
          description: 'Description',
          price: '450000 EUR',
          priceAmount: null,
        },
      ] as Property[];

      extractionService.extractMany.mockRejectedValue(
        new Error('AI batch timeout'),
      );
      repository.save.mockImplementation(async (payload) => payload);

      const updated = await service.updatePropertiesFromAi(properties);

      expect(updated).toMatchObject([
        {
          id: 1,
          priceAmount: null,
          aiResponseError: expect.stringContaining('AI batch timeout'),
        },
        {
          id: 2,
          priceAmount: null,
          aiResponseError: expect.stringContaining('AI batch timeout'),
        },
      ]);
    });

    it('returns an empty array without calling the extraction service', async () => {
      const updated = await service.updatePropertiesFromAi([]);

      expect(updated).toEqual([]);
      expect(extractionService.extractMany).not.toHaveBeenCalled();
    });
  });

  it('finds properties that need AI metadata enrichment', async () => {
    const properties = [{ id: 1 }, { id: 2 }] as Property[];
    const now = new Date('2026-07-26T12:00:00.000Z');
    const twentyFourHoursAgo = new Date('2026-07-25T12:00:00.000Z');

    jest.useFakeTimers().setSystemTime(now);
    repository.find.mockResolvedValue(properties);

    try {
      await expect(service.findPropertiesNeedingAiMetadata(10)).resolves.toBe(
        properties,
      );
      expect(repository.find).toHaveBeenCalledWith({
        where: [
          {
            createdAt: MoreThanOrEqual(twentyFourHoursAgo),
            aiMetadataUpdatedAt: IsNull(),
          },
          {
            createdAt: MoreThanOrEqual(twentyFourHoursAgo),
            aiResponseError: Not(IsNull()),
          },
        ],
        order: { updatedAt: 'DESC' },
        take: 10,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('queues property creation in the background', () => {
    const properties = [
      {
        providerId: 'provider-1',
        title: 'Property 1',
        url: 'https://example.com/property/1',
        description: 'Description 1',
        price: '100000 EUR',
      },
    ] as Property[];

    const createPropertiesSpy = jest
      .spyOn(service, 'createProperties')
      .mockResolvedValue(properties);

    service.queueCreateProperties(properties);

    expect(createPropertiesSpy).toHaveBeenCalledWith(properties);
  });

  it('applies propertyTypes to the list query filters', async () => {
    repository.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: '0' }]);
    repository.update.mockResolvedValue({ affected: 0 });

    await service.getProperties(1, 10, {
      propertyTypes: ['SHOP', 'VILLA'],
    });

    expect(repository.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ranked_properties."propertyType" IN ($1, $2)'),
      ['SHOP', 'VILLA', 10, 0],
    );
    expect(repository.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ranked_properties."propertyType" IN ($1, $2)'),
      ['SHOP', 'VILLA'],
    );
  });

  it('applies areaIds to the list query filters', async () => {
    repository.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: '0' }]);
    repository.update.mockResolvedValue({ affected: 0 });

    await service.getProperties(1, 10, {
      areaIds: [3, 5],
    });

    expect(repository.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ranked_properties."areaId" IN ($1, $2)'),
      [3, 5, 10, 0],
    );
    expect(repository.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ranked_properties."areaId" IN ($1, $2)'),
      [3, 5],
    );
  });

  it('joins the area table so listed properties carry an areaName', async () => {
    repository.query
      .mockResolvedValueOnce([{ id: 1, areaId: 3, areaName: 'Blloku' }])
      .mockResolvedValueOnce([{ total: '1' }]);
    repository.update.mockResolvedValue({ affected: 0 });

    const result = await service.getProperties(1, 10, {});

    expect(repository.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('LEFT JOIN area ON area.id = property."areaId"'),
      [10, 0],
    );
    expect(result.data[0]).toMatchObject({ areaName: 'Blloku' });
  });

  it('selects the area price snapshot fields needed to classify a Price Position', async () => {
    repository.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: '0' }]);
    repository.update.mockResolvedValue({ affected: 0 });

    await service.getProperties(1, 10, {});

    expect(repository.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('area."avgPricePerSqm" as "areaAvgPricePerSqm"'),
      [10, 0],
    );
  });

  it('classifies a listed property as above the area average', async () => {
    repository.query
      .mockResolvedValueOnce([
        {
          id: 1,
          priceAmount: 111000,
          priceCurrency: 'EUR',
          squareMeters: 100,
          areaAvgPricePerSqm: '1000',
          areaAvgPriceCurrency: 'EUR',
          areaSnapshotPropertyCount: '5',
        },
      ])
      .mockResolvedValueOnce([{ total: '1' }]);
    repository.update.mockResolvedValue({ affected: 0 });

    const result = await service.getProperties(1, 10, {});

    expect(result.data[0]).toMatchObject({
      pricePosition: 'above',
      pricePositionPercentage: 11,
      areaAvgPricePerSqm: 1000,
      areaSnapshotPropertyCount: 5,
    });
  });

  it('omits the Price Position when the area has no eligible snapshot yet', async () => {
    repository.query
      .mockResolvedValueOnce([
        {
          id: 1,
          priceAmount: 111000,
          priceCurrency: 'EUR',
          squareMeters: 100,
          areaAvgPricePerSqm: null,
          areaAvgPriceCurrency: null,
          areaSnapshotPropertyCount: null,
        },
      ])
      .mockResolvedValueOnce([{ total: '1' }]);
    repository.update.mockResolvedValue({ affected: 0 });

    const result = await service.getProperties(1, 10, {});

    expect(result.data[0]).toMatchObject({
      pricePosition: null,
      pricePositionPercentage: null,
    });
  });

  describe('getPropertiesByProviderId', () => {
    it('joins the area relation and classifies each property Price Position', async () => {
      repository.findAndCount.mockResolvedValue([
        [
          {
            id: 1,
            providerId: 'provider-1',
            priceAmount: 89000,
            priceCurrency: 'EUR',
            squareMeters: 100,
            area: {
              name: 'Blloku',
              avgPricePerSqm: 1000,
              avgPriceCurrency: 'EUR',
              snapshotPropertyCount: 5,
            },
          },
          {
            id: 2,
            providerId: 'provider-1',
            priceAmount: 100000,
            priceCurrency: 'EUR',
            squareMeters: 100,
            area: null,
          },
        ],
        2,
      ]);

      const result = await service.getPropertiesByProviderId(
        1,
        10,
        'provider-1',
      );

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['area'] }),
      );
      expect(result.data[0]).toMatchObject({
        areaName: 'Blloku',
        areaAvgPricePerSqm: 1000,
        areaSnapshotPropertyCount: 5,
        pricePosition: 'below',
        pricePositionPercentage: -11,
      });
      expect(result.data[0]).not.toHaveProperty('area');
      expect(result.data[1]).toMatchObject({
        areaName: null,
        pricePosition: null,
        pricePositionPercentage: null,
      });
    });
  });

  describe('getNewPropertiesSeries', () => {
    it('returns 120 ascending Tirane dates with missing dates zero-filled', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-19T12:00:00.000Z'));
      repository.query.mockResolvedValue([
        { date: '2026-04-22', count: '2' },
        { date: '2026-08-19', count: '5' },
      ]);

      try {
        const series = await service.getNewPropertiesSeries();

        expect(series).toHaveLength(120);
        expect(series[0]).toEqual({
          date: '2026-04-22',
          count: 2,
        });
        expect(series[1]).toEqual({
          date: '2026-04-23',
          count: 0,
        });
        expect(series[119]).toEqual({
          date: '2026-08-19',
          count: 5,
        });
        const [query] = repository.query.mock.calls[0];
        expect(query).toContain('MIN(property."createdAt")');
        expect(query).toContain('GROUP BY property."providerId"');
        expect(query).toContain('::date - 119');
        expect(query).toContain('::date + 1');
      } finally {
        jest.useRealTimers();
      }
    });

    it.each([
      ['spring DST change', '2026-03-29T22:30:00.000Z', '2026-03-30'],
      ['autumn DST change', '2026-10-25T23:30:00.000Z', '2026-10-26'],
    ])('uses Tirane calendar dates across the %s', async (_, now, today) => {
      jest.useFakeTimers().setSystemTime(new Date(now));
      repository.query.mockResolvedValue([]);

      try {
        const series = await service.getNewPropertiesSeries();

        expect(series.at(-1)).toEqual({
          date: today,
          count: 0,
        });
        expect(repository.query).toHaveBeenCalledWith(
          expect.stringContaining('AT TIME ZONE $2'),
          [new Date(now), 'Europe/Tirane'],
        );
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('updateProperty', () => {
    it('applies validated changes, records history, and locks the edited fields', async () => {
      const property = {
        id: 20,
        providerId: 'provider-20',
        title: 'Old title',
        description: 'Old description',
        priceAmount: 100000,
        priceCurrency: 'EUR',
        squareMeters: 60,
        propertyType: 'APARTMENT_2_1',
        areaId: null,
        manuallyEditedFields: [],
      } as unknown as Property;

      repository.findOne.mockResolvedValue(property);
      repository.save.mockImplementation(async (payload) => payload);

      const updated = await service.updateProperty(
        20,
        { title: '  New title  ', priceAmount: 150000 },
        7,
      );

      expect(repository.save).toHaveBeenCalledWith({
        ...property,
        title: 'New title',
        priceAmount: 150000,
        manuallyEditedFields: ['title', 'priceAmount'],
      });
      expect(editHistoryRepository.insert).toHaveBeenCalledWith([
        {
          propertyId: 20,
          userId: 7,
          field: 'title',
          oldValue: 'Old title',
          newValue: 'New title',
        },
        {
          propertyId: 20,
          userId: 7,
          field: 'priceAmount',
          oldValue: '100000',
          newValue: '150000',
        },
      ]);
      expect(updated).toMatchObject({
        title: 'New title',
        priceAmount: 150000,
      });
    });

    it('does not touch already-locked fields again if resubmitted with the same value', async () => {
      const property = {
        id: 21,
        title: 'Title',
        description: 'Description',
        manuallyEditedFields: ['title'],
      } as unknown as Property;

      repository.findOne.mockResolvedValue(property);

      const updated = await service.updateProperty(21, { title: 'Title' }, 7);

      expect(repository.save).not.toHaveBeenCalled();
      expect(editHistoryRepository.insert).not.toHaveBeenCalled();
      expect(updated).toBe(property);
    });

    it('validates areaId against existing Areas before saving', async () => {
      const property = {
        id: 22,
        title: 'Title',
        description: 'Description',
        areaId: null,
        manuallyEditedFields: [],
      } as unknown as Property;

      repository.findOne.mockResolvedValue(property);
      areasService.findOne.mockRejectedValue(
        new Error('Area with id 999 not found'),
      );

      await expect(
        service.updateProperty(22, { areaId: 999 }, 7),
      ).rejects.toThrow('Area with id 999 not found');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid propertyType', async () => {
      const property = {
        id: 23,
        title: 'Title',
        description: 'Description',
        manuallyEditedFields: [],
      } as unknown as Property;

      repository.findOne.mockResolvedValue(property);

      await expect(
        service.updateProperty(23, { propertyType: 'NOT_A_TYPE' } as any, 7),
      ).rejects.toThrow('Invalid property type');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a blank title', async () => {
      const property = {
        id: 24,
        title: 'Title',
        description: 'Description',
        manuallyEditedFields: [],
      } as unknown as Property;

      repository.findOne.mockResolvedValue(property);

      await expect(
        service.updateProperty(24, { title: '   ' }, 7),
      ).rejects.toThrow('Title is required');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws when the property does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProperty(404, { title: 'New title' }, 7),
      ).rejects.toThrow('Property with id 404 not found');
    });
  });

  describe('AI updates respecting manual overrides', () => {
    it('skips fields already manually edited when updating a single property from AI', async () => {
      const property = {
        id: 30,
        providerId: 'provider-30',
        title: 'Apartment',
        description: 'Description',
        price: '100000 EUR',
        priceAmount: 999999,
        priceCurrency: 'EUR',
        squareMeters: 60,
        propertyType: 'APARTMENT_2_1',
        manuallyEditedFields: ['priceAmount'],
      } as unknown as Property;

      repository.findOne.mockResolvedValue(property);
      extractionService.extract.mockResolvedValue({
        priceAmount: 111111,
        priceCurrency: 'EUR',
        squareMeters: 65,
        propertyType: 'STUDIO',
      });
      repository.save.mockImplementation(async (payload) => payload);

      await service.updatePropertyFromAi(30);

      expect(repository.save).toHaveBeenCalledWith({
        ...property,
        priceCurrency: 'EUR',
        squareMeters: 65,
        propertyType: 'STUDIO',
        areaId: null,
        aiResponseError: null,
        aiMetadataUpdatedAt: expect.any(Date),
      });
    });

    it('skips locked fields when batch-updating properties from AI', async () => {
      const properties = [
        {
          id: 31,
          providerId: 'provider-31',
          title: 'Apartment',
          description: 'Description',
          price: '100000 EUR',
          priceAmount: 500000,
          manuallyEditedFields: ['priceAmount'],
        },
      ] as unknown as Property[];

      extractionService.extractMany.mockResolvedValue([
        {
          priceAmount: 111111,
          priceCurrency: 'EUR',
          squareMeters: 65,
          propertyType: 'STUDIO',
          areaName: null,
        },
      ]);
      repository.save.mockImplementation(async (payload) => payload);

      const updated = await service.updatePropertiesFromAi(properties);

      expect(updated).toMatchObject([{ id: 31, priceAmount: 500000 }]);
    });
  });
});
