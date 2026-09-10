import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Area } from './area.entity';
import { AreaPriceSnapshot } from './area-price-snapshot.entity';
import {
  isResidentialPropertyType,
  Property,
} from '../properties/property.entity';

const SNAPSHOT_WINDOW_DAYS = 30;

function dedupeToLatestCapturePerListing(properties: Property[]): Property[] {
  const latestByProviderId = new Map<string, Property>();

  for (const property of properties) {
    const current = latestByProviderId.get(property.providerId);

    if (!current || property.createdAt > current.createdAt) {
      latestByProviderId.set(property.providerId, property);
    }
  }

  return [...latestByProviderId.values()];
}

function determineDominantCurrency(properties: Property[]): string | null {
  const counts = new Map<string, number>();

  for (const property of properties) {
    if (property.priceCurrency == null) {
      continue;
    }

    counts.set(
      property.priceCurrency,
      (counts.get(property.priceCurrency) ?? 0) + 1,
    );
  }

  let dominantCurrency: string | null = null;
  let dominantCount = 0;

  for (const [currency, count] of counts) {
    if (count > dominantCount) {
      dominantCurrency = currency;
      dominantCount = count;
    }
  }

  return dominantCurrency;
}

type EligibleProperty = Property & {
  priceAmount: number;
  squareMeters: number;
};

function isEligible(
  property: Property,
  dominantCurrency: string | null,
): property is EligibleProperty {
  if (property.priceAmount == null || property.priceAmount <= 0) {
    return false;
  }

  if (property.squareMeters == null || property.squareMeters <= 0) {
    return false;
  }

  if (property.priceCurrency == null) {
    return false;
  }

  return property.priceCurrency === dominantCurrency;
}

function meanPricePerSqm(properties: EligibleProperty[]): number {
  const total = properties.reduce(
    (sum, property) => sum + property.priceAmount / property.squareMeters,
    0,
  );

  return total / properties.length;
}

@Injectable()
export class AreaPriceSnapshotsService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(AreaPriceSnapshot)
    private readonly snapshotRepository: Repository<AreaPriceSnapshot>,
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
  ) {}

  async computeSnapshotForArea(area: Area): Promise<AreaPriceSnapshot> {
    const windowStart = new Date(
      Date.now() - SNAPSHOT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const capturesInWindow = await this.propertyRepository.find({
      where: { areaId: area.id, createdAt: MoreThanOrEqual(windowStart) },
    });

    const residentialCaptures = capturesInWindow.filter((property) =>
      isResidentialPropertyType(property.propertyType),
    );

    const deduped = dedupeToLatestCapturePerListing(residentialCaptures);
    const dominantCurrency = determineDominantCurrency(deduped);
    const eligible = deduped.filter((property) =>
      isEligible(property, dominantCurrency),
    );

    const ranAt = new Date();
    const propertyCount = eligible.length;
    const avgPricePerSqm = propertyCount > 0 ? meanPricePerSqm(eligible) : null;
    const currency = propertyCount > 0 ? dominantCurrency : null;
    const excludedCount = capturesInWindow.length - propertyCount;

    const snapshot = await this.snapshotRepository.save({
      areaId: area.id,
      ranAt,
      avgPricePerSqm,
      currency,
      propertyCount,
      excludedCount,
    });

    await this.areaRepository.update(
      { id: area.id },
      {
        avgPricePerSqm,
        avgPriceCurrency: currency,
        snapshotPropertyCount: propertyCount,
        snapshotAt: ranAt,
      },
    );

    return snapshot;
  }
}
