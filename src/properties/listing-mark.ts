import { In, Repository } from 'typeorm';
import { ListingMark } from './listing-mark.entity';

export async function attachListingMarks<T extends { providerId: string }>(
  listingMarkRepository: Repository<ListingMark>,
  rows: T[],
): Promise<(T & { bookmarked: boolean; dismissed: boolean })[]> {
  const providerIds = [...new Set(rows.map((row) => row.providerId))];
  const marks =
    providerIds.length > 0
      ? await listingMarkRepository.find({
          where: { providerId: In(providerIds) },
        })
      : [];
  const statusByProviderId = new Map(
    marks.map((mark) => [mark.providerId, mark.status]),
  );

  return rows.map((row) => ({
    ...row,
    bookmarked: statusByProviderId.get(row.providerId) === 'bookmarked',
    dismissed: statusByProviderId.get(row.providerId) === 'dismissed',
  }));
}
