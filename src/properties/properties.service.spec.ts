import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let repository: {
    save: jest.Mock;
    query: jest.Mock;
    update: jest.Mock;
  };
  let extractionService: { extract: jest.Mock };

  beforeEach(async () => {
    repository = {
      save: jest.fn(),
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
    });
    expect(saved).toMatchObject({
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
      propertyType: 'APARTMENT_2_1',
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

    expect(repository.save).toHaveBeenCalledWith(property);
    expect(saved).toMatchObject({
      priceAmount: 95000,
      priceCurrency: 'EUR',
      squareMeters: 72,
      propertyType: 'VILLA',
    });
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
