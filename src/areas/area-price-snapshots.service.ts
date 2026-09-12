import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { Area } from './area.entity';
import { AreaPriceSnapshot } from './area-price-snapshot.entity';
import { Property } from '../properties/property.entity';
import { computePricePosition } from '../properties/price-position';
import {
  dedupeToLatestCapturePerListing,
  determineDominantCurrency,
  filterResidential,
  getSnapshotWindowStart,
  isEligibleContributingListing,
  meanPricePerSqm,
} from './contributing-listings.util';

export interface ContributingListingsPage {
  summary: {
    areaId: number;
    areaName: string;
    avgPricePerSqm: number | null;
    avgPriceCurrency: string | null;
    propertyCount: number;
    windowStart: Date | null;
    windowEnd: Date | null;
    highlightedListingIncluded: boolean | null;
  };
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AreaPriceSnapshotsService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(AreaPriceSnapshot)
    private readonly snapshotRepository: Repository<AreaPriceSnapshot>,
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
  ) {}

  async computeSnapshotForArea(area: Area): Promise<AreaPriceSnapshot> {
    const ranAt = new Date();
    const windowStart = getSnapshotWindowStart(ranAt);

    const capturesInWindow = await this.propertyRepository.find({
      where: { areaId: area.id, createdAt: MoreThanOrEqual(windowStart) },
    });

    const residentialCaptures = filterResidential(capturesInWindow);
    const deduped = dedupeToLatestCapturePerListing(residentialCaptures);
    const dominantCurrency = determineDominantCurrency(deduped);
    const eligible = deduped.filter((property) =>
      isEligibleContributingListing(property, dominantCurrency),
    );

    const propertyCount = eligible.length;
    const avgPricePerSqm = propertyCount > 0 ? meanPricePerSqm(eligible) : null;
    const currency = propertyCount > 0 ? dominantCurrency : null;
    const excludedCount = capturesInWindow.length - propertyCount;

    const snapshot = await this.snapshotRepository.save({
      areaId: area.id,
      ranAt,
      avgPricePerSqm,
      currency,
      propertyCount,
      excludedCount,
    });

    await this.areaRepository.update(
      { id: area.id },
      {
        avgPricePerSqm,
        avgPriceCurrency: currency,
        snapshotPropertyCount: propertyCount,
        snapshotAt: ranAt,
      },
    );

    return snapshot;
  }

  async getContributingListings(
    areaId: number,
    page: number,
    limit: number,
    highlightProviderId?: string,
  ): Promise<ContributingListingsPage> {
    const area = await this.areaRepository.findOne({ where: { id: areaId } });

    if (!area) {
      throw new NotFoundException(`Area with id ${areaId} not found`);
    }

    const windowEnd = area.snapshotAt;
    const windowStart = windowEnd ? getSnapshotWindowStart(windowEnd) : null;

    const capturesInWindow =
      windowEnd && windowStart
        ? await this.propertyRepository.find({
            where: {
              areaId: area.id,
              createdAt: Between(windowStart, windowEnd),
            },
          })
        : [];

    const residentialCaptures = filterResidential(capturesInWindow);
    const deduped = dedupeToLatestCapturePerListing(residentialCaptures);
    const contributingListings = deduped
      .filter((property) =>
        isEligibleContributingListing(property, area.avgPriceCurrency),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = contributingListings.length;
    const start = (page - 1) * limit;
    const pageOfListings = contributingListings.slice(start, start + limit);
    const highlightedListingIncluded = highlightProviderId
      ? contributingListings.some(
          (property) => property.providerId === highlightProviderId,
        )
      : null;

    const enrichedData = pageOfListings.map((property) => {
      const { pricePosition, pricePositionPercentage } = computePricePosition(
        {
          priceAmount: property.priceAmount,
          priceCurrency: property.priceCurrency,
          squareMeters: property.squareMeters,
        },
        {
          avgPricePerSqm: area.avgPricePerSqm,
          avgPriceCurrency: area.avgPriceCurrency,
          snapshotPropertyCount: area.snapshotPropertyCount,
        },
      );

      return {
        ...property,
        areaName: area.name,
        areaAvgPricePerSqm: area.avgPricePerSqm,
        areaAvgPriceCurrency: area.avgPriceCurrency,
        areaSnapshotPropertyCount: area.snapshotPropertyCount,
        pricePosition,
        pricePositionPercentage,
      };
    });

    return {
      summary: {
        areaId: area.id,
        areaName: area.name,
        avgPricePerSqm: area.avgPricePerSqm,
        avgPriceCurrency: area.avgPriceCurrency,
        propertyCount: total,
        windowStart,
        windowEnd,
        highlightedListingIncluded,
      },
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
