export type PricePosition = 'above' | 'below' | 'in_line';

export const PRICE_POSITION_BAND_PERCENT = 5;
export const PRICE_POSITION_MIN_SNAPSHOT_SAMPLE_SIZE = 5;

export interface PricePositionPropertyInput {
  priceEur: number | null;
  squareMeters: number | null;
}

export interface PricePositionAreaInput {
  avgPricePerSqm: number | null;
  snapshotPropertyCount: number | null;
}

export interface PricePositionResult {
  pricePosition: PricePosition | null;
  pricePositionPercentage: number | null;
}

const NO_PRICE_POSITION: PricePositionResult = {
  pricePosition: null,
  pricePositionPercentage: null,
};

export function computePricePosition(
  property: PricePositionPropertyInput,
  area: PricePositionAreaInput | null | undefined,
): PricePositionResult {
  if (
    area == null ||
    property.priceEur == null ||
    property.squareMeters == null ||
    property.squareMeters <= 0 ||
    area.avgPricePerSqm == null ||
    area.avgPricePerSqm <= 0 ||
    (area.snapshotPropertyCount ?? 0) < PRICE_POSITION_MIN_SNAPSHOT_SAMPLE_SIZE
  ) {
    return NO_PRICE_POSITION;
  }

  const pricePerSqm = property.priceEur / property.squareMeters;
  const percentage =
    ((pricePerSqm - area.avgPricePerSqm) / area.avgPricePerSqm) * 100;

  const pricePosition: PricePosition =
    percentage > PRICE_POSITION_BAND_PERCENT
      ? 'above'
      : percentage < -PRICE_POSITION_BAND_PERCENT
        ? 'below'
        : 'in_line';

  return { pricePosition, pricePositionPercentage: Math.round(percentage) };
}
