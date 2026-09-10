import { computePricePosition } from './price-position';

describe('computePricePosition', () => {
  const eligibleArea = {
    avgPricePerSqm: 1000,
    avgPriceCurrency: 'EUR',
    snapshotPropertyCount: 5,
  };

  it('classifies a property priced more than 5% above the area average as above', () => {
    const result = computePricePosition(
      { priceAmount: 111000, priceCurrency: 'EUR', squareMeters: 100 },
      eligibleArea,
    );

    expect(result).toEqual({ pricePosition: 'above', pricePositionPercentage: 11 });
  });

  it('classifies a property priced more than 5% below the area average as below', () => {
    const result = computePricePosition(
      { priceAmount: 89000, priceCurrency: 'EUR', squareMeters: 100 },
      eligibleArea,
    );

    expect(result).toEqual({ pricePosition: 'below', pricePositionPercentage: -11 });
  });

  it.each([
    ['exactly at the average', 100000],
    ['just inside the +5% band', 104000],
    ['just inside the -5% band', 96000],
  ])('classifies a property %s as in line', (_, priceAmount) => {
    const result = computePricePosition(
      { priceAmount, priceCurrency: 'EUR', squareMeters: 100 },
      eligibleArea,
    );

    expect(result.pricePosition).toBe('in_line');
  });

  it('returns no price position when the area has no snapshot yet', () => {
    const result = computePricePosition(
      { priceAmount: 200000, priceCurrency: 'EUR', squareMeters: 100 },
      { avgPricePerSqm: null, avgPriceCurrency: null, snapshotPropertyCount: null },
    );

    expect(result).toEqual({ pricePosition: null, pricePositionPercentage: null });
  });

  it('returns no price position when the property has no area at all', () => {
    const result = computePricePosition(
      { priceAmount: 200000, priceCurrency: 'EUR', squareMeters: 100 },
      null,
    );

    expect(result).toEqual({ pricePosition: null, pricePositionPercentage: null });
  });

  it.each([
    ['priceAmount', { priceAmount: null, priceCurrency: 'EUR', squareMeters: 100 }],
    ['priceCurrency', { priceAmount: 110000, priceCurrency: null, squareMeters: 100 }],
    ['squareMeters', { priceAmount: 110000, priceCurrency: 'EUR', squareMeters: null }],
  ])('returns no price position when the property is missing %s', (_, property) => {
    const result = computePricePosition(property, eligibleArea);

    expect(result).toEqual({ pricePosition: null, pricePositionPercentage: null });
  });

  it('returns no price position when the property currency differs from the area currency', () => {
    const result = computePricePosition(
      { priceAmount: 110000, priceCurrency: 'ALL', squareMeters: 100 },
      eligibleArea,
    );

    expect(result).toEqual({ pricePosition: null, pricePositionPercentage: null });
  });

  it('returns no price position when the area snapshot sample is below the minimum', () => {
    const result = computePricePosition(
      { priceAmount: 200000, priceCurrency: 'EUR', squareMeters: 100 },
      { ...eligibleArea, snapshotPropertyCount: 4 },
    );

    expect(result).toEqual({ pricePosition: null, pricePositionPercentage: null });
  });
});
