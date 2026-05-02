import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let repository: { save: jest.Mock };
  let extractionService: { extract: jest.Mock };

  beforeEach(async () => {
    repository = {
      save: jest.fn(),
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
    });
    repository.save.mockImplementation(async (payload) => payload);

    const saved = await service.createProperty(property);

    expect(extractionService.extract).toHaveBeenCalledWith(property);
    expect(repository.save).toHaveBeenCalledWith({
      ...property,
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
    });
    expect(saved).toMatchObject({
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
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
    } as Property;

    extractionService.extract.mockResolvedValue({
      priceAmount: 120000,
      priceCurrency: 'USD',
      squareMeters: 85,
    });
    repository.save.mockImplementation(async (payload) => payload);

    const saved = await service.createProperty(property);

    expect(repository.save).toHaveBeenCalledWith(property);
    expect(saved).toMatchObject({
      priceAmount: 95000,
      priceCurrency: 'EUR',
      squareMeters: 72,
    });
  });
});
