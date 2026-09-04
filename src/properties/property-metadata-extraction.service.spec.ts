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
      '{"priceAmount":120000,"priceCurrency":"eur","squareMeters":85,"propertyType":"APARTMENT_2_1"}',
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
      propertyType: 'APARTMENT_2_1',
      areaName: null,
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
      propertyType: null,
      areaName: null,
    });
  });

  it('rounds decimal square meters from the provider response', async () => {
    aiProvider.generateText.mockResolvedValue(
      '{"priceAmount":120000.5,"priceCurrency":"EUR","squareMeters":85.2,"propertyType":"Invalid"}',
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
      squareMeters: 85,
      propertyType: null,
      areaName: null,
    });
  });

  it('extracts square meters from Albanian listing text when the provider misses it', async () => {
    aiProvider.generateText.mockResolvedValue(
      '{"priceAmount":208000,"priceCurrency":"EUR","squareMeters":null,"propertyType":"APARTMENT_2_1"}',
    );

    const result = await service.extract({
      title: 'Shitet super Apartament 2+1',
      description:
        'Shitet super Apartament 2+1 tek Residenca Manhattan 1, tek unaza e vogel kryqezimi i Don Boskos. 📐Siperfaqe totale 122.05 m2 prej te cilave 98 m2 neto. Apartamenti ndodhet ne katin 14 me orientim Lindje dhe Jug, plot drite dhe diell. Super Pamje 💥Cmimi OKAZION 1.700 €/m² 💥Total 208.000 €💥',
      price: '208000 EUR',
      url: 'https://example.com/property/4',
    });

    expect(result).toEqual({
      priceAmount: 208000,
      priceCurrency: 'EUR',
      squareMeters: 122,
      propertyType: 'APARTMENT_2_1',
      areaName: null,
    });
  });

  it('includes the active Area name roster in the built prompt', async () => {
    aiProvider.generateText.mockResolvedValue(
      '{"priceAmount":null,"priceCurrency":null,"squareMeters":null,"propertyType":null,"area":null}',
    );

    await service.extract(
      {
        title: 'Apartment',
        description: 'Description',
        price: 'raw',
        url: 'https://example.com/property/5',
      },
      ['Blloku', 'Tirana e Re'],
    );

    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Blloku, Tirana e Re'),
      { responseMimeType: 'application/json' },
    );
  });

  it('returns a roster name that matches the listing as areaName', async () => {
    aiProvider.generateText.mockResolvedValue(
      '{"priceAmount":null,"priceCurrency":null,"squareMeters":null,"propertyType":null,"area":"Blloku"}',
    );

    const result = await service.extract(
      {
        title: 'Apartment in Blloku',
        description: 'Description',
        price: 'raw',
        url: 'https://example.com/property/6',
      },
      ['Blloku', 'Tirana e Re'],
    );

    expect(result.areaName).toBe('Blloku');
  });

  it('returns a novel proposed name as areaName when nothing in the roster fits', async () => {
    aiProvider.generateText.mockResolvedValue(
      '{"priceAmount":null,"priceCurrency":null,"squareMeters":null,"propertyType":null,"area":"Kombinat"}',
    );

    const result = await service.extract(
      {
        title: 'Apartment in Kombinat',
        description: 'Description',
        price: 'raw',
        url: 'https://example.com/property/7',
      },
      ['Blloku', 'Tirana e Re'],
    );

    expect(result.areaName).toBe('Kombinat');
  });

  describe('extractMany', () => {
    const properties = [
      {
        title: 'Apartment 1',
        description: '85 m2 apartment',
        price: '120000 EUR',
        url: 'https://example.com/property/1',
      },
      {
        title: 'Apartment 2',
        description: '60 m2 apartment',
        price: '90000 EUR',
        url: 'https://example.com/property/2',
      },
    ];

    it('returns an empty array without calling the AI provider', async () => {
      const result = await service.extractMany([]);

      expect(result).toEqual([]);
      expect(aiProvider.generateText).not.toHaveBeenCalled();
    });

    it('extracts metadata for every listing, realigned by index rather than response order', async () => {
      aiProvider.generateText.mockResolvedValue(
        JSON.stringify([
          {
            index: 1,
            priceAmount: 90000,
            priceCurrency: 'EUR',
            squareMeters: 60,
            propertyType: 'STUDIO',
            area: null,
          },
          {
            index: 0,
            priceAmount: 120000,
            priceCurrency: 'EUR',
            squareMeters: 85,
            propertyType: 'APARTMENT_2_1',
            area: 'Blloku',
          },
        ]),
      );

      const result = await service.extractMany(properties, ['Blloku']);

      expect(aiProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Blloku'),
        { responseMimeType: 'application/json' },
      );
      expect(result).toEqual([
        {
          priceAmount: 120000,
          priceCurrency: 'EUR',
          squareMeters: 85,
          propertyType: 'APARTMENT_2_1',
          areaName: 'Blloku',
        },
        {
          priceAmount: 90000,
          priceCurrency: 'EUR',
          squareMeters: 60,
          propertyType: 'STUDIO',
          areaName: null,
        },
      ]);
    });

    it('falls back to the regex square meters extraction for a matched item missing it', async () => {
      aiProvider.generateText.mockResolvedValue(
        JSON.stringify([
          {
            index: 0,
            priceAmount: 208000,
            priceCurrency: 'EUR',
            squareMeters: null,
            propertyType: 'APARTMENT_2_1',
            area: null,
          },
        ]),
      );

      const result = await service.extractMany([
        {
          title: 'Shitet Apartament 2+1',
          description: 'Siperfaqe totale 122.05 m2',
          price: '208000 EUR',
          url: 'https://example.com/property/1',
        },
      ]);

      expect(result[0].squareMeters).toBe(122);
    });

    it('throws when the AI provider returns no response', async () => {
      aiProvider.generateText.mockResolvedValue(null);

      await expect(service.extractMany(properties)).rejects.toThrow(
        'AI provider returned no response for batch metadata extraction',
      );
    });

    it('throws when the response is not valid JSON', async () => {
      aiProvider.generateText.mockResolvedValue('not-json');

      await expect(service.extractMany(properties)).rejects.toThrow();
    });

    it('throws when the response is missing a result for one of the listings', async () => {
      aiProvider.generateText.mockResolvedValue(
        JSON.stringify([
          {
            index: 0,
            priceAmount: 120000,
            priceCurrency: 'EUR',
            squareMeters: 85,
            propertyType: 'APARTMENT_2_1',
            area: null,
          },
        ]),
      );

      await expect(service.extractMany(properties)).rejects.toThrow(
        'AI batch metadata response is missing a result for listing index 1',
      );
    });
  });
});
