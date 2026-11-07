import { convertToEur } from './convert-to-eur';

// Sell Rate: lek received for one unit of the currency.
const rates = { EUR: 100, USD: 95 };

describe('convertToEur', () => {
  it('keeps a euro price as it is', () => {
    expect(convertToEur(95000, 'EUR', rates)).toBe(95000);
  });

  it('converts lek by dividing by the euro Sell Rate', () => {
    expect(convertToEur(9_500_000, 'ALL', rates)).toBe(95000);
  });

  it('converts dollars through lek', () => {
    // 100,000 USD * 95 lek = 9,500,000 lek / 100 lek per EUR
    expect(convertToEur(100_000, 'USD', rates)).toBe(95000);
  });

  it('rounds to whole euros', () => {
    expect(convertToEur(1_000_001, 'ALL', rates)).toBe(10000);
    expect(convertToEur(150, 'ALL', rates)).toBe(2);
  });

  it('ignores case and surrounding spaces in the currency', () => {
    expect(convertToEur(9_500_000, ' all ', rates)).toBe(95000);
  });

  it('has no euro price for another or missing currency', () => {
    expect(convertToEur(5000, 'GBP', rates)).toBeNull();
    expect(convertToEur(5000, null, rates)).toBeNull();
  });

  it('has no euro price for a missing or non-positive amount', () => {
    expect(convertToEur(null, 'EUR', rates)).toBeNull();
    expect(convertToEur(0, 'EUR', rates)).toBeNull();
    expect(convertToEur(-10, 'EUR', rates)).toBeNull();
  });

  it('has no euro price when the needed rate is missing', () => {
    expect(convertToEur(9_500_000, 'ALL', {})).toBeNull();
    expect(convertToEur(100_000, 'USD', { EUR: 100 })).toBeNull();
    // a euro price needs no rate at all
    expect(convertToEur(95000, 'EUR', {})).toBe(95000);
  });
});
