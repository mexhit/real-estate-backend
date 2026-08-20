export const NEW_PROPERTIES_SERIES_TIME_ZONE = 'Europe/Tirane';
export const NEW_PROPERTIES_SERIES_DAYS = 120;

export type NewPropertySeriesPoint = {
  date: string;
  count: number;
};

export type NewPropertySeriesRow = {
  date: string;
  count: string | number;
};

function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addCalendarDays(dateKey: string, numberOfDays: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + numberOfDays));

  return date.toISOString().slice(0, 10);
}

export function buildNewPropertiesSeries(
  rows: NewPropertySeriesRow[],
  now: Date,
  timeZone = NEW_PROPERTIES_SERIES_TIME_ZONE,
  numberOfDays = NEW_PROPERTIES_SERIES_DAYS,
): NewPropertySeriesPoint[] {
  const counts = new Map(rows.map((row) => [row.date, Number(row.count)]));
  const today = getDateKeyInTimeZone(now, timeZone);
  const firstDate = addCalendarDays(today, -(numberOfDays - 1));

  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = addCalendarDays(firstDate, index);
    return {
      date,
      count: counts.get(date) ?? 0,
    };
  });
}
