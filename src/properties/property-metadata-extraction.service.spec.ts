import { Test, TestingModule } from '@nestjs/testing';
import { AI_PROVIDER } from './ai-provider.interface';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';

describe('PropertyMetadataExtractionService', () => {
  let service: PropertyMetadataExtractionService;
  let aiProvider: { generateText: jest.Mock };

  beforeEach(async () => {
    aiProvider = {
      generateText: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyMetadataExtractionService,
        {
          provide: AI_PROVIDER,
          useValue: aiProvider,
        },
      ],
    }).compile();

    service = module.get<PropertyMetadataExtractionService>(
      PropertyMetadataExtractionService,
    );
  });

  it('extracts normalized property metadata from the AI provider output', async () => {
    aiProvider.generateText.mockResolvedValue(
      '{"priceAmount":120000,"priceCurrency":"eur","squareMeters":85}',
    );

    const result = await service.extract({
      title: 'Apartment',
      description: '85 m2 apartment',
      price: '120000 EUR',
      url: 'https://example.com/property/1',
    });

    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Extract normalized real-estate data'),
      { responseMimeType: 'application/json' },
    );
    expect(result).toEqual({
      priceAmount: 120000,
      priceCurrency: 'EUR',
      squareMeters: 85,
    });
  });

  it('returns null fields when the provider response is unusable', async () => {
    aiProvider.generateText.mockResolvedValue('not-json');

    const result = await service.extract({
      title: 'Apartment',
      description: 'Description',
      price: 'raw',
      url: 'https://example.com/property/2',
    });

    expect(result).toEqual({
      priceAmount: null,
      priceCurrency: null,
      squareMeters: null,
    });
  });

  it('rejects decimal values for integer-only fields', async () => {
    aiProvider.generateText.mockResolvedValue(
      '{"priceAmount":120000.5,"priceCurrency":"EUR","squareMeters":85.2}',
    );

    const result = await service.extract({
      title: 'Apartment',
      description: 'Description',
      price: 'raw',
      url: 'https://example.com/property/3',
    });

    expect(result).toEqual({
      priceAmount: null,
      priceCurrency: 'EUR',
      squareMeters: null,
    });
  });
});
