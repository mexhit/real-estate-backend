import { buildNewPropertiesSeries } from './new-properties-series.helper';

describe('buildNewPropertiesSeries', () => {
  it('creates an ascending, zero-filled series and normalizes database counts', () => {
    const series = buildNewPropertiesSeries(
      [
        { date: '2026-08-18', count: '2' },
        { date: '2026-08-20', count: 5 },
      ],
      new Date('2026-08-20T12:00:00.000Z'),
      'Europe/Tirane',
      3,
    );

    expect(series).toEqual([
      { date: '2026-08-18', count: 2 },
      { date: '2026-08-19', count: 0 },
      { date: '2026-08-20', count: 5 },
    ]);
  });

  it.each([
    ['spring DST change', '2026-03-29T22:30:00.000Z', '2026-03-30'],
    ['autumn DST change', '2026-10-25T23:30:00.000Z', '2026-10-26'],
  ])('uses Tirane calendar dates across the %s', (_, now, expectedDate) => {
    const series = buildNewPropertiesSeries([], new Date(now));

    expect(series.at(-1)).toEqual({ date: expectedDate, count: 0 });
  });
});
