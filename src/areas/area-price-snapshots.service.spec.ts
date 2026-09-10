import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AreaPriceSnapshotsService } from './area-price-snapshots.service';
import { Area } from './area.entity';
import { AreaPriceSnapshot } from './area-price-snapshot.entity';
import { Property } from '../properties/property.entity';

function makeProperty(overrides: Partial<Property>): Property {
  return {
    id: 1,
    providerId: 'provider-1',
    title: 'Apartment',
    url: 'https://example.com/1',
    description: '',
    price: '',
    priceAmount: 100000,
    priceCurrency: 'EUR',
    squareMeters: 100,
    propertyType: null,
    areaId: 1,
    area: null,
    aiResponseError: null,
    aiMetadataUpdatedAt: null,
    seen: false,
    bookmarked: false,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  } as Property;
}

describe('AreaPriceSnapshotsService', () => {
  let service: AreaPriceSnapshotsService;
  let propertyRepository: { find: jest.Mock };
  let snapshotRepository: { save: jest.Mock };
  let areaRepository: { update: jest.Mock };
  const area = { id: 1, name: 'Blloku' } as Area;

  beforeEach(async () => {
    propertyRepository = { find: jest.fn().mockResolvedValue([]) };
    snapshotRepository = {
      save: jest.fn().mockImplementation(async (payload) => payload),
    };
    areaRepository = { update: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreaPriceSnapshotsService,
        { provide: getRepositoryToken(Property), useValue: propertyRepository },
        {
          provide: getRepositoryToken(AreaPriceSnapshot),
          useValue: snapshotRepository,
        },
        { provide: getRepositoryToken(Area), useValue: areaRepository },
      ],
    }).compile();

    service = module.get<AreaPriceSnapshotsService>(AreaPriceSnapshotsService);
  });

  it('computes the mean of each listing’s own price/m² ratio, not sum(price)/sum(m²)', async () => {
    propertyRepository.find.mockResolvedValue([
      makeProperty({
        providerId: 'p1',
        priceAmount: 100000,
        squareMeters: 100,
      }), // 1000/m2
      makeProperty({
        providerId: 'p2',
        priceAmount: 300000,
        squareMeters: 100,
      }), // 3000/m2
    ]);

    const snapshot = await service.computeSnapshotForArea(area);

    expect(snapshot.avgPricePerSqm).toBe(2000);
    expect(snapshot.currency).toBe('EUR');
    expect(snapshot.propertyCount).toBe(2);
    expect(snapshot.excludedCount).toBe(0);
  });

  it('excludes listings with missing or zero/invalid price or size', async () => {
    propertyRepository.find.mockResolvedValue([
      makeProperty({
        providerId: 'p1',
        priceAmount: 100000,
        squareMeters: 100,
      }),
      makeProperty({ providerId: 'p2', priceAmount: null, squareMeters: 100 }),
      makeProperty({ providerId: 'p3', priceAmount: 0, squareMeters: 100 }),
      makeProperty({
        providerId: 'p4',
        priceAmount: 100000,
        squareMeters: null,
      }),
      makeProperty({ providerId: 'p5', priceAmount: 100000, squareMeters: 0 }),
      makeProperty({ providerId: 'p6', priceAmount: 100000, squareMeters: -5 }),
    ]);

    const snapshot = await service.computeSnapshotForArea(area);

    expect(snapshot.propertyCount).toBe(1);
    expect(snapshot.excludedCount).toBe(5);
  });

  it('excludes listings outside the Dominant Currency, including null currency', async () => {
    propertyRepository.find.mockResolvedValue([
      makeProperty({ providerId: 'p1', priceCurrency: 'EUR' }),
      makeProperty({ providerId: 'p2', priceCurrency: 'EUR' }),
      makeProperty({ providerId: 'p3', priceCurrency: 'USD' }),
      makeProperty({ providerId: 'p4', priceCurrency: null }),
    ]);

    const snapshot = await service.computeSnapshotForArea(area);

    expect(snapshot.currency).toBe('EUR');
    expect(snapshot.propertyCount).toBe(2);
    expect(snapshot.excludedCount).toBe(2);
  });

  it('dedups to the most-recent Capture per providerId and never falls back to an older, valid Capture', async () => {
    propertyRepository.find.mockResolvedValue([
      makeProperty({
        providerId: 'p1',
        createdAt: new Date('2026-09-01T00:00:00Z'),
        priceAmount: 100000,
        squareMeters: 100,
      }),
      makeProperty({
        providerId: 'p1',
        createdAt: new Date('2026-09-03T00:00:00Z'),
        priceAmount: null,
        squareMeters: 100,
      }),
    ]);

    const snapshot = await service.computeSnapshotForArea(area);

    expect(snapshot.propertyCount).toBe(0);
    expect(snapshot.excludedCount).toBe(2);
    expect(snapshot.avgPricePerSqm).toBeNull();
  });

  it('picks the currency shared by the most deduped rows as Dominant Currency', async () => {
    propertyRepository.find.mockResolvedValue([
      makeProperty({
        providerId: 'p1',
        createdAt: new Date('2026-09-01T00:00:00Z'),
        priceCurrency: 'USD',
      }),
      makeProperty({
        providerId: 'p1',
        createdAt: new Date('2026-09-02T00:00:00Z'),
        priceCurrency: 'EUR',
      }),
      makeProperty({ providerId: 'p2', priceCurrency: 'EUR' }),
    ]);

    const snapshot = await service.computeSnapshotForArea(area);

    expect(snapshot.currency).toBe('EUR');
    expect(snapshot.propertyCount).toBe(2);
  });

  it('clears the average to null and still writes a Snapshot with propertyCount 0 when nothing is eligible', async () => {
    propertyRepository.find.mockResolvedValue([
      makeProperty({ providerId: 'p1', priceAmount: null }),
    ]);

    const snapshot = await service.computeSnapshotForArea(area);

    expect(snapshot.avgPricePerSqm).toBeNull();
    expect(snapshot.currency).toBeNull();
    expect(snapshot.propertyCount).toBe(0);
    expect(snapshot.excludedCount).toBe(1);
    expect(snapshotRepository.save).toHaveBeenCalled();
  });

  it('overwrites the denormalized Area columns to match the new Snapshot', async () => {
    propertyRepository.find.mockResolvedValue([
      makeProperty({
        providerId: 'p1',
        priceAmount: 200000,
        squareMeters: 100,
      }),
    ]);

    const snapshot = await service.computeSnapshotForArea(area);

    expect(areaRepository.update).toHaveBeenCalledWith(
      { id: 1 },
      {
        avgPricePerSqm: snapshot.avgPricePerSqm,
        avgPriceCurrency: snapshot.currency,
        snapshotPropertyCount: snapshot.propertyCount,
        snapshotAt: snapshot.ranAt,
      },
    );
  });

  it('excludes non-Residential Property Types from the average, but includes untyped listings', async () => {
    propertyRepository.find.mockResolvedValue([
      makeProperty({
        providerId: 'p1',
        propertyType: 'APARTMENT_1_1',
        priceAmount: 100000,
        squareMeters: 100,
      }), // 1000/m2, residential
      makeProperty({
        providerId: 'p2',
        propertyType: null,
        priceAmount: 100000,
        squareMeters: 100,
      }), // 1000/m2, untyped -> treated as residential
      makeProperty({
        providerId: 'p3',
        propertyType: 'SHOP',
        priceAmount: 400000,
        squareMeters: 100,
      }), // 4000/m2, excluded
      makeProperty({
        providerId: 'p4',
        propertyType: 'OFFICE',
        priceAmount: 400000,
        squareMeters: 100,
      }), // excluded
      makeProperty({
        providerId: 'p5',
        propertyType: 'LAND',
        priceAmount: 400000,
        squareMeters: 100,
      }), // excluded
      makeProperty({
        providerId: 'p6',
        propertyType: 'PARKING',
        priceAmount: 400000,
        squareMeters: 100,
      }), // excluded
    ]);

    const snapshot = await service.computeSnapshotForArea(area);

    expect(snapshot.avgPricePerSqm).toBe(1000);
    expect(snapshot.propertyCount).toBe(2);
    expect(snapshot.excludedCount).toBe(4);
  });

  it('overwrites denormalized Area columns to null/zero when there is no eligible data', async () => {
    propertyRepository.find.mockResolvedValue([]);

    await service.computeSnapshotForArea(area);

    expect(areaRepository.update).toHaveBeenCalledWith(
      { id: 1 },
      {
        avgPricePerSqm: null,
        avgPriceCurrency: null,
        snapshotPropertyCount: 0,
        snapshotAt: expect.any(Date),
      },
    );
  });
});
