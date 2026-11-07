// Sell Rate per currency: lek received for one unit of that currency.
export type ConversionRates = Partial<Record<'EUR' | 'USD', number>>;

/**
 * Euro Price of an Original Price. Pure: the same amount, currency and rates
 * always give the same result. Returns null when no Euro Price can be derived.
 */
export function convertToEur(
  amount: number | null,
  currency: string | null,
  rates: ConversionRates,
): number | null {
  if (amount == null || amount <= 0 || currency == null) {
    return null;
  }

  switch (currency.trim().toUpperCase()) {
    case 'EUR':
      return Math.round(amount);
    case 'ALL':
      return rates.EUR ? Math.round(amount / rates.EUR) : null;
    case 'USD':
      return rates.USD && rates.EUR
        ? Math.round((amount * rates.USD) / rates.EUR)
        : null;
    default:
      return null;
  }
}
