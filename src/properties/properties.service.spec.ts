import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let repository: {
    save: jest.Mock;
    findOne: jest.Mock;
    query: jest.Mock;
    update: jest.Mock;
  };
  let extractionService: { extract: jest.Mock };

  beforeEach(async () => {
    repository = {
      save: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
    };
    extractionService = {
      extract: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: getRepositoryToken(Property),
          useValue: repository,
        },
        {
          provide: PropertyMetadataExtractionService,
          useValue: extractionService,
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

    expect(extractionService.extract).toHaveBeenCalledWith(property);
    expect(repository.save).toHaveBeenCalledWith({
      ...property,
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
      propertyType: 'APARTMENT_2_1',
      aiResponseError: null,
    });
    expect(saved).toMatchObject({
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
      propertyType: 'APARTMENT_2_1',
      aiResponseError: null,
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
      aiResponseError: null,
    });
    expect(saved).toMatchObject({
      priceAmount: 95000,
      priceCurrency: 'EUR',
      squareMeters: 72,
      propertyType: 'VILLA',
      aiResponseError: null,
    });
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
      aiResponseError: expect.stringContaining('AI timeout'),
    });
    expect(saved).toMatchObject({
      aiResponseError: expect.stringContaining('AI timeout'),
    });
  });

  it('creates properties one by one using createProperty', async () => {
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

    const createPropertySpy = jest
      .spyOn(service, 'createProperty')
      .mockImplementation(async (property) => property);

    const created = await service.createProperties(properties);

    expect(createPropertySpy).toHaveBeenNthCalledWith(1, properties[0]);
    expect(createPropertySpy).toHaveBeenNthCalledWith(2, properties[1]);
    expect(created).toEqual(properties);
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
    expect(extractionService.extract).toHaveBeenCalledWith(property);
    expect(repository.save).toHaveBeenCalledWith({
      ...property,
      priceAmount: 450000,
      priceCurrency: 'EUR',
      squareMeters: 180,
      propertyType: 'VILLA',
      aiResponseError: null,
    });
    expect(updated).toMatchObject({
      priceAmount: 450000,
      priceCurrency: 'EUR',
      squareMeters: 180,
      propertyType: 'VILLA',
      aiResponseError: null,
    });
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
    });
    expect(updated).toMatchObject({
      priceAmount: 100000,
      priceCurrency: 'EUR',
      squareMeters: 70,
      propertyType: 'APARTMENT_2_1',
      aiResponseError: expect.stringContaining('AI timeout'),
    });
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
});
