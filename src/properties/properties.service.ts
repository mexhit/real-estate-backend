import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  normalizePropertyType,
  Property,
  PropertyType,
} from './property.entity';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';
import {
  buildNewPropertiesSeries,
  NEW_PROPERTIES_SERIES_DAYS,
  NEW_PROPERTIES_SERIES_TIME_ZONE,
  NewPropertySeriesPoint,
  NewPropertySeriesRow,
} from './new-properties-series.helper';
import { AreasService } from '../areas/areas.service';

export type { NewPropertySeriesPoint } from './new-properties-series.helper';

type PropertyFilters = {
  fromDate?: Date;
  toDate?: Date;
  onlyUnseen?: boolean;
  onlyBookmarked?: boolean;
  onlyPriceChanged?: boolean;
  propertyTypes?: PropertyType[];
  areaIds?: number[];
};

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    private readonly propertyMetadataExtractionService: PropertyMetadataExtractionService,
    private readonly areasService: AreasService,
  ) {}

  async getProperties(page: number, limit: number, filters?: PropertyFilters) {
    const conditions: string[] = [];
    const whereParams: any[] = [];
    let paramIndex = 1;

    if (filters.fromDate) {
      conditions.push(`ranked_properties."createdAt" >= $${paramIndex}`);
      whereParams.push(filters.fromDate);
      paramIndex++;
    }

    if (filters.toDate) {
      conditions.push(`ranked_properties."createdAt" <= $${paramIndex}`);
      whereParams.push(filters.toDate);
      paramIndex++;
    }

    if (filters.onlyUnseen) {
      conditions.push(`ranked_properties."seen" = $${paramIndex}`);
      whereParams.push(false);
      paramIndex++;
    }

    if (filters.onlyBookmarked) {
      conditions.push(`ranked_properties."bookmarked" = $${paramIndex}`);
      whereParams.push(true);
      paramIndex++;
    }

    if (filters.onlyPriceChanged) {
      conditions.push(`ranked_properties."has_price_changed" = $${paramIndex}`);
      whereParams.push(true);
      paramIndex++;
    }

    if (filters.propertyTypes && filters.propertyTypes.length > 0) {
      const placeholders = filters.propertyTypes.map(() => `$${paramIndex++}`);
      conditions.push(
        `ranked_properties."propertyType" IN (${placeholders.join(', ')})`,
      );
      whereParams.push(...filters.propertyTypes);
    }

    if (filters.areaIds && filters.areaIds.length > 0) {
      const placeholders = filters.areaIds.map(() => `$${paramIndex++}`);
      conditions.push(
        `ranked_properties."areaId" IN (${placeholders.join(', ')})`,
      );
      whereParams.push(...filters.areaIds);
    }

    const whereSql =
      conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    const query = `
      WITH price_change_check AS (
        SELECT
          property."providerId",
          COUNT(DISTINCT property.price) > 1 as has_price_changed
        FROM property
        GROUP BY property."providerId"
      ),
     ranked_properties AS (
       SELECT
         property.*,
         area.name as "areaName",
         COUNT(*) OVER (PARTITION BY property."providerId") as provider_property_count,
         ROW_NUMBER() OVER (PARTITION BY property."providerId" ORDER BY property.id DESC) as rn,
         pcc.has_price_changed,
         MIN(property."createdAt") OVER (PARTITION BY property."providerId") as first_post,
         MAX(property."createdAt") OVER (PARTITION BY property."providerId") as last_post,
         FIRST_VALUE(property.price) OVER (PARTITION BY property."providerId" ORDER BY property.id ASC) as first_price,
         FIRST_VALUE(property.price) OVER (PARTITION BY property."providerId" ORDER BY property.id DESC) as last_price
       FROM property
              LEFT JOIN price_change_check pcc ON pcc."providerId" = property."providerId"
              LEFT JOIN area ON area.id = property."areaId"
     )
      SELECT *
      FROM ranked_properties
      WHERE rn = 1 ${whereSql}
      ORDER BY id DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const queryParams = [...whereParams, limit, (page - 1) * limit];

    const countQuery = `
      WITH price_change_check AS (
        SELECT
          property."providerId",
          COUNT(DISTINCT property.price) > 1 as has_price_changed
        FROM property
        GROUP BY property."providerId"
      ),
       ranked_properties AS (
         SELECT
           property.*,
           COUNT(*) OVER (PARTITION BY property."providerId") as provider_property_count,
           ROW_NUMBER() OVER (PARTITION BY property."providerId" ORDER BY property.id DESC) as rn,
           pcc.has_price_changed,
           MIN(property."createdAt") OVER (PARTITION BY property."providerId") as first_post,
           MAX(property."createdAt") OVER (PARTITION BY property."providerId") as last_post,
           FIRST_VALUE(property.price) OVER (PARTITION BY property."providerId" ORDER BY property.id ASC) as first_price,
           FIRST_VALUE(property.price) OVER (PARTITION BY property."providerId" ORDER BY property.id DESC) as last_price
         FROM property
                LEFT JOIN price_change_check pcc ON pcc."providerId" = property."providerId"
       )
        SELECT COUNT(*) as total
        FROM ranked_properties
        WHERE rn = 1 ${whereSql}
    `;

    const [data, [{ total }]] = await Promise.all([
      this.propertyRepository.query(query, queryParams),
      this.propertyRepository.query(countQuery, whereParams),
    ]);

    const enrichedData = data.map((entity) => ({
      ...entity,
      providerPropertyCount: Number(entity.provider_property_count || 0),
      hasPriceChanged: entity.has_price_changed,
      firstPostedAt: entity.first_post,
      lastPostedAt: entity.last_post,
      firstPrice: entity.first_price,
      lastPrice: entity.last_price,
    }));

    await this.markPropertiesAsSeen(enrichedData.map((p) => p.id));

    return {
      data: enrichedData,
      total: Number(total),
      page,
      limit,
      totalPages: Math.ceil(Number(total) / limit),
    };
  }

  async getNewPropertiesSeries(): Promise<NewPropertySeriesPoint[]> {
    const now = new Date();

    const rows: NewPropertySeriesRow[] = await this.propertyRepository.query(
      `
          WITH first_seen AS (
            SELECT property."providerId", MIN(property."createdAt") AS first_seen_at
            FROM property
            GROUP BY property."providerId"
          )
          SELECT
            TO_CHAR(
              first_seen_at AT TIME ZONE $2,
              'YYYY-MM-DD'
            ) AS date,
            COUNT(*) AS count
          FROM first_seen
          WHERE first_seen_at >= (
            ((($1::timestamptz AT TIME ZONE $2)::date - ${NEW_PROPERTIES_SERIES_DAYS - 1})::timestamp
              AT TIME ZONE $2)
          )
          AND first_seen_at < (
            ((($1::timestamptz AT TIME ZONE $2)::date + 1)::timestamp
              AT TIME ZONE $2)
          )
          GROUP BY date
          ORDER BY date ASC
        `,
      [now, NEW_PROPERTIES_SERIES_TIME_ZONE],
    );

    return buildNewPropertiesSeries(rows, now);
  }

  async getPropertiesByProviderId(
    page: number,
    limit: number,
    providerId: string,
  ) {
    const whereCondition = providerId ? { providerId } : {};

    const [data, total] = await this.propertyRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'DESC' },
      where: whereCondition,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createProperty(property: Property): Promise<Property> {
    let extractedMetadata: Awaited<
      ReturnType<PropertyMetadataExtractionService['extract']>
    > | null = null;
    let aiResponseError: string | null = null;
    let resolvedAreaId: number | null = null;

    try {
      const activeAreaNames = await this.areasService.listActiveNames();

      extractedMetadata = await this.propertyMetadataExtractionService.extract(
        property,
        activeAreaNames,
      );

      if (property.areaId == null) {
        resolvedAreaId = await this.resolveAreaId(extractedMetadata.areaName);
      }
    } catch (error: unknown) {
      aiResponseError = this.formatAiResponseError(error);
      this.logger.warn(
        `AI metadata extraction failed for providerId=${property.providerId}`,
        aiResponseError,
      );
    }

    const normalizedPropertyType = normalizePropertyType(property.propertyType);
    const aiMetadataUpdatedAt = new Date();

    return this.propertyRepository.save({
      ...property,
      priceAmount:
        property.priceAmount ?? extractedMetadata?.priceAmount ?? null,
      priceCurrency:
        property.priceCurrency ?? extractedMetadata?.priceCurrency ?? null,
      squareMeters:
        property.squareMeters ?? extractedMetadata?.squareMeters ?? null,
      propertyType:
        normalizedPropertyType ?? extractedMetadata?.propertyType ?? null,
      areaId: property.areaId ?? resolvedAreaId ?? null,
      aiResponseError,
      aiMetadataUpdatedAt,
    });
  }

  async createProperties(properties: Property[]): Promise<Property[]> {
    const createdProperties: Property[] = [];

    for (const property of properties) {
      createdProperties.push(await this.createProperty(property));
    }

    return createdProperties;
  }

  async updatePropertyFromAi(propertyId: number): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with id ${propertyId} not found`);
    }

    try {
      const activeAreaNames = await this.areasService.listActiveNames();
      const extractedMetadata =
        await this.propertyMetadataExtractionService.extract(
          property,
          activeAreaNames,
        );

      const areaId = await this.resolveAreaId(extractedMetadata.areaName);

      return this.propertyRepository.save({
        ...property,
        priceAmount: extractedMetadata.priceAmount,
        priceCurrency: extractedMetadata.priceCurrency,
        squareMeters: extractedMetadata.squareMeters,
        propertyType: extractedMetadata.propertyType,
        areaId,
        aiResponseError: null,
        aiMetadataUpdatedAt: new Date(),
      });
    } catch (error: unknown) {
      const aiResponseError = this.formatAiResponseError(error);

      this.logger.warn(
        `AI metadata extraction failed for propertyId=${propertyId}`,
        aiResponseError,
      );

      return this.propertyRepository.save({
        ...property,
        aiResponseError,
        aiMetadataUpdatedAt: new Date(),
      });
    }
  }

  findPropertiesNeedingAiMetadata(limit: number): Promise<Property[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.propertyRepository.find({
      where: [
        {
          createdAt: MoreThanOrEqual(twentyFourHoursAgo),
          aiMetadataUpdatedAt: IsNull(),
        },
        {
          createdAt: MoreThanOrEqual(twentyFourHoursAgo),
          aiResponseError: Not(IsNull()),
        },
      ],
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  queueCreateProperties(properties: Property[]): void {
    void this.createProperties(properties).catch((error: unknown) => {
      const message =
        error instanceof Error ? (error.stack ?? error.message) : String(error);

      this.logger.error(
        `Failed to process queued property batch of ${properties.length} items`,
        message,
      );
    });
  }

  bookmarkProperty(id: number, bookmarked: boolean = true) {
    return this.propertyRepository.update({ id }, { bookmarked });
  }

  async markPropertiesAsSeen(ids: number[]): Promise<void> {
    if (!ids || ids.length === 0) return;

    await this.propertyRepository.update({ id: In(ids) }, { seen: true });
  }

  private formatAiResponseError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }

  private async resolveAreaId(areaName: string | null): Promise<number | null> {
    if (!areaName) {
      return null;
    }

    const area = await this.areasService.findOrCreate(areaName);

    return area.id;
  }
}
