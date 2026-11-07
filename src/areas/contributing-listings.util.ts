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

export type EligibleContributingListing = Property & {
  priceEur: number;
  squareMeters: number;
};

export function isEligibleContributingListing(
  property: Property,
): property is EligibleContributingListing {
  if (property.priceEur == null || property.priceEur <= 0) {
    return false;
  }

  return property.squareMeters != null && property.squareMeters > 0;
}

export function meanPricePerSqm(properties: EligibleContributingListing[]): number {
  const total = properties.reduce(
    (sum, property) => sum + property.priceEur / property.squareMeters,
    0,
  );

  return total / properties.length;
}
