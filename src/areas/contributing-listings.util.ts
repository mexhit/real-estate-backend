import { isResidentialPropertyType, Property } from '../properties/property.entity';

export const SNAPSHOT_WINDOW_DAYS = 30;

export function getSnapshotWindowStart(windowEnd: Date): Date {
  return new Date(windowEnd.getTime() - SNAPSHOT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function filterResidential(properties: Property[]): Property[] {
  return properties.filter((property) =>
    isResidentialPropertyType(property.propertyType),
  );
}

export function dedupeToLatestCapturePerListing(properties: Property[]): Property[] {
  const latestByProviderId = new Map<string, Property>();

  for (const property of properties) {
    const current = latestByProviderId.get(property.providerId);

    if (!current || property.createdAt > current.createdAt) {
      latestByProviderId.set(property.providerId, property);
    }
  }

  return [...latestByProviderId.values()];
}

export function determineDominantCurrency(properties: Property[]): string | null {
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

export type EligibleContributingListing = Property & {
  priceAmount: number;
  squareMeters: number;
};

export function isEligibleContributingListing(
  property: Property,
  currency: string | null,
): property is EligibleContributingListing {
  if (property.priceAmount == null || property.priceAmount <= 0) {
    return false;
  }

  if (property.squareMeters == null || property.squareMeters <= 0) {
    return false;
  }

  if (property.priceCurrency == null) {
    return false;
  }

  return property.priceCurrency === currency;
}

export function meanPricePerSqm(properties: EligibleContributingListing[]): number {
  const total = properties.reduce(
    (sum, property) => sum + property.priceAmount / property.squareMeters,
    0,
  );

  return total / properties.length;
}
