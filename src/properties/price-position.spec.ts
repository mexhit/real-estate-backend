import { computePricePosition } from './price-position';

describe('computePricePosition', () => {
  const eligibleArea = {
    avgPricePerSqm: 1000,
    snapshotPropertyCount: 5,
  };

  it('classifies a property priced more than 5% above the area average as above', () => {
    const result = computePricePosition(
      { priceEur: 111000, squareMeters: 100 },
      eligibleArea,
    );

    expect(result).toEqual({
      pricePosition: 'above',
      pricePositionPercentage: 11,
    });
  });

  it('classifies a property priced more than 5% below the area average as below', () => {
    const result = computePricePosition(
      { priceEur: 89000, squareMeters: 100 },
      eligibleArea,
    );

    expect(result).toEqual({
      pricePosition: 'below',
      pricePositionPercentage: -11,
    });
  });

  it.each([
    ['exactly at the average', 100000],
    ['just inside the +5% band', 104000],
    ['just inside the -5% band', 96000],
  ])('classifies a property %s as in line', (_, priceEur) => {
    const result = computePricePosition(
      { priceEur, squareMeters: 100 },
      eligibleArea,
    );

    expect(result.pricePosition).toBe('in_line');
  });

  it('returns no price position when the area has no snapshot yet', () => {
    const result = computePricePosition(
      { priceEur: 200000, squareMeters: 100 },
      { avgPricePerSqm: null, snapshotPropertyCount: null },
    );

    expect(result).toEqual({
      pricePosition: null,
      pricePositionPercentage: null,
    });
  });

  it('returns no price position when the property has no area at all', () => {
    const result = computePricePosition(
      { priceEur: 200000, squareMeters: 100 },
      null,
    );

    expect(result).toEqual({
      pricePosition: null,
      pricePositionPercentage: null,
    });
  });

  it.each([
    ['a Euro Price', { priceEur: null, squareMeters: 100 }],
    ['squareMeters', { priceEur: 110000, squareMeters: null }],
  ])('returns no price position when the property is missing %s', (_, property) => {
    const result = computePricePosition(property, eligibleArea);

    expect(result).toEqual({
      pricePosition: null,
      pricePositionPercentage: null,
    });
  });

  it('returns no price position when the area snapshot sample is below the minimum', () => {
    const result = computePricePosition(
      { priceEur: 200000, squareMeters: 100 },
      { ...eligibleArea, snapshotPropertyCount: 4 },
    );

    expect(result).toEqual({
      pricePosition: null,
      pricePositionPercentage: null,
    });
  });
});
