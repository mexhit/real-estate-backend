import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  normalizePropertyType,
  Property,
  PropertyType,
} from './property.entity';
import { PropertyEditHistory } from './property-edit-history.entity';
import {
  ExtractedPropertyMetadata,
  PropertyMetadataExtractionService,
} from './property-metadata-extraction.service';
import {
  buildNewPropertiesSeries,
  NEW_PROPERTIES_SERIES_DAYS,
  NEW_PROPERTIES_SERIES_TIME_ZONE,
  NewPropertySeriesPoint,
  NewPropertySeriesRow,
} from './new-properties-series.helper';
import { AreasService } from '../areas/areas.service';
import { computePricePosition } from './price-position';

export type { NewPropertySeriesPoint } from './new-properties-series.helper';

const MANUALLY_EDITABLE_FIELDS = [
  'title',
  'description',
  'priceAmount',
  'priceCurrency',
  'squareMeters',
  'propertyType',
  'areaId',
] as const;

export type ManuallyEditableField = (typeof MANUALLY_EDITABLE_FIELDS)[number];

export type PropertyManualUpdate = Partial<
  Pick<Property, ManuallyEditableField>
>;

type PropertyFilters = {
  fromDate?: Date;
  toDate?: Date;
  onlyUnseen?: boolean;
  onlyBookmarked?: boolean;
  onlyPriceChanged?: boolean;
  propertyTypes?: PropertyType[];
  areaIds?: number[];
};

const DEFAULT_BULK_CREATE_AI_CHUNK_SIZE = 5;

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);
  private readonly bulkCreateAiChunkSize: number;

  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(PropertyEditHistory)
    private propertyEditHistoryRepository: Repository<PropertyEditHistory>,
    private readonly propertyMetadataExtractionService: PropertyMetadataExtractionService,
    private readonly areasService: AreasService,
    private readonly configService: ConfigService,
  ) {
    this.bulkCreateAiChunkSize = Math.max(
      1,
      Number(
        this.configService.get<string>(
          'BULK_CREATE_AI_CHUNK_SIZE',
          String(DEFAULT_BULK_CREATE_AI_CHUNK_SIZE),
        ),
      ),
    );
  }

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
         area."avgPricePerSqm" as "areaAvgPricePerSqm",
         area."avgPriceCurrency" as "areaAvgPriceCurrency",
         area."snapshotPropertyCount" as "areaSnapshotPropertyCount",
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

    const enrichedData = data.map((entity) => {
      const areaAvgPricePerSqm =
        entity.areaAvgPricePerSqm != null
          ? Number(entity.areaAvgPricePerSqm)
          : null;
      const areaSnapshotPropertyCount =
        entity.areaSnapshotPropertyCount != null
          ? Number(entity.areaSnapshotPropertyCount)
          : null;
      const { pricePosition, pricePositionPercentage } = computePricePosition(
        {
          priceAmount: entity.priceAmount,
          priceCurrency: entity.priceCurrency,
          squareMeters: entity.squareMeters,
        },
        {
          avgPricePerSqm: areaAvgPricePerSqm,
          avgPriceCurrency: entity.areaAvgPriceCurrency,
          snapshotPropertyCount: areaSnapshotPropertyCount,
        },
      );

      return {
        ...entity,
        providerPropertyCount: Number(entity.provider_property_count || 0),
        hasPriceChanged: entity.has_price_changed,
        firstPostedAt: entity.first_post,
        lastPostedAt: entity.last_post,
        firstPrice: entity.first_price,
        lastPrice: entity.last_price,
        areaAvgPricePerSqm,
        areaAvgPriceCurrency: entity.areaAvgPriceCurrency,
        areaSnapshotPropertyCount,
        pricePosition,
        pricePositionPercentage,
      };
    });

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
      relations: ['area'],
    });

    const enrichedData = data.map(({ area, ...property }) => {
      const { pricePosition, pricePositionPercentage } = computePricePosition(
        {
          priceAmount: property.priceAmount,
          priceCurrency: property.priceCurrency,
          squareMeters: property.squareMeters,
        },
        area
          ? {
              avgPricePerSqm: area.avgPricePerSqm,
              avgPriceCurrency: area.avgPriceCurrency,
              snapshotPropertyCount: area.snapshotPropertyCount,
            }
          : null,
      );

      return {
        ...property,
        areaName: area?.name ?? null,
        areaAvgPricePerSqm: area?.avgPricePerSqm ?? null,
        areaAvgPriceCurrency: area?.avgPriceCurrency ?? null,
        areaSnapshotPropertyCount: area?.snapshotPropertyCount ?? null,
        pricePosition,
        pricePositionPercentage,
      };
    });

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createProperty(property: Property): Promise<Property> {
    let extractedMetadata: ExtractedPropertyMetadata | null = null;
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

    return this.propertyRepository.save(
      this.buildCreatePayload(
        property,
        extractedMetadata,
        resolvedAreaId,
        aiResponseError,
      ),
    );
  }

  async createProperties(properties: Property[]): Promise<Property[]> {
    if (properties.length === 0) {
      return [];
    }

    const activeAreaNames = await this.areasService.listActiveNames();
    const createdProperties: Property[] = [];

    for (const chunk of this.chunkArray(
      properties,
      this.bulkCreateAiChunkSize,
    )) {
      let extractedMetadataByProperty: (ExtractedPropertyMetadata | null)[];
      let aiResponseError: string | null = null;

      try {
        extractedMetadataByProperty =
          await this.propertyMetadataExtractionService.extractMany(
            chunk,
            activeAreaNames,
          );
      } catch (error: unknown) {
        aiResponseError = this.formatAiResponseError(error);
        this.logger.warn(
          `AI batch metadata extraction failed for a chunk of ${chunk.length} properties`,
          aiResponseError,
        );
        extractedMetadataByProperty = chunk.map(() => null);
      }

      for (let i = 0; i < chunk.length; i++) {
        const property = chunk[i];
        const extractedMetadata = extractedMetadataByProperty[i];
        let resolvedAreaId: number | null = null;

        if (property.areaId == null && extractedMetadata) {
          resolvedAreaId = await this.resolveAreaId(extractedMetadata.areaName);
        }

        createdProperties.push(
          await this.propertyRepository.save(
            this.buildCreatePayload(
              property,
              extractedMetadata,
              resolvedAreaId,
              aiResponseError,
            ),
          ),
        );
      }
    }

    return createdProperties;
  }

  private buildCreatePayload(
    property: Property,
    extractedMetadata: ExtractedPropertyMetadata | null,
    resolvedAreaId: number | null,
    aiResponseError: string | null,
  ): Property {
    const normalizedPropertyType = normalizePropertyType(property.propertyType);

    return {
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
      aiMetadataUpdatedAt: new Date(),
    };
  }

  private buildAiFieldPatch(
    property: Property,
    aiValues: Pick<
      Property,
      'priceAmount' | 'priceCurrency' | 'squareMeters' | 'propertyType' | 'areaId'
    >,
  ): Partial<Property> {
    const lockedFields = new Set(property.manuallyEditedFields ?? []);
    const patch: Partial<Property> = {};

    for (const field of [
      'priceAmount',
      'priceCurrency',
      'squareMeters',
      'propertyType',
      'areaId',
    ] as const) {
      if (!lockedFields.has(field)) {
        (patch as any)[field] = aiValues[field];
      }
    }

    return patch;
  }

  async updateProperty(
    id: number,
    updates: PropertyManualUpdate,
    editedByUserId: number,
  ): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException(`Property with id ${id} not found`);
    }

    const patch: Partial<Property> = {};
    const changes: {
      field: ManuallyEditableField;
      oldValue: unknown;
      newValue: unknown;
    }[] = [];

    for (const field of MANUALLY_EDITABLE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(updates, field)) {
        continue;
      }

      const newValue = await this.validateManualEditValue(
        field,
        updates[field],
      );
      const oldValue = property[field];

      if (newValue === oldValue) {
        continue;
      }

      (patch as any)[field] = newValue;
      changes.push({ field, oldValue, newValue });
    }

    if (changes.length === 0) {
      return property;
    }

    const manuallyEditedFields = Array.from(
      new Set([
        ...(property.manuallyEditedFields ?? []),
        ...changes.map((change) => change.field),
      ]),
    );

    const saved = await this.propertyRepository.save({
      ...property,
      ...patch,
      manuallyEditedFields,
    });

    await this.propertyEditHistoryRepository.insert(
      changes.map((change) => ({
        propertyId: id,
        userId: editedByUserId,
        field: change.field,
        oldValue: change.oldValue == null ? null : String(change.oldValue),
        newValue: change.newValue == null ? null : String(change.newValue),
      })),
    );

    return saved;
  }

  private async validateManualEditValue(
    field: ManuallyEditableField,
    value: unknown,
  ): Promise<unknown> {
    switch (field) {
      case 'title': {
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new BadRequestException('Title is required');
        }

        return value.trim();
      }
      case 'description': {
        if (typeof value !== 'string') {
          throw new BadRequestException('Description must be text');
        }

        return value.trim();
      }
      case 'priceAmount':
      case 'squareMeters': {
        if (value === null) {
          return null;
        }

        const numericValue = Number(value);

        if (!Number.isInteger(numericValue) || numericValue <= 0) {
          throw new BadRequestException(
            field === 'priceAmount'
              ? 'Price must be a positive whole number'
              : 'Square meters must be a positive whole number',
          );
        }

        return numericValue;
      }
      case 'priceCurrency': {
        if (value === null) {
          return null;
        }

        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new BadRequestException('Currency is required');
        }

        return value.trim().toUpperCase();
      }
      case 'propertyType': {
        if (value === null) {
          return null;
        }

        const normalized = normalizePropertyType(value);

        if (!normalized) {
          throw new BadRequestException('Invalid property type');
        }

        return normalized;
      }
      case 'areaId': {
        if (value === null) {
          return null;
        }

        const numericValue = Number(value);

        if (!Number.isInteger(numericValue)) {
          throw new BadRequestException('areaId must be a number');
        }

        // Throws NotFoundException if the area doesn't exist (or is deleted).
        await this.areasService.findOne(numericValue);

        return numericValue;
      }
    }
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }

    return chunks;
  }

  async updatePropertyFromAi(
    propertyId: number,
  ): Promise<Property & { areaName: string | null }> {
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with id ${propertyId} not found`);
    }

    let saved: Property;

    try {
      const activeAreaNames = await this.areasService.listActiveNames();
      const extractedMetadata =
        await this.propertyMetadataExtractionService.extract(
          property,
          activeAreaNames,
        );

      const areaId = await this.resolveAreaId(extractedMetadata.areaName);

      saved = await this.propertyRepository.save({
        ...property,
        ...this.buildAiFieldPatch(property, {
          priceAmount: extractedMetadata.priceAmount,
          priceCurrency: extractedMetadata.priceCurrency,
          squareMeters: extractedMetadata.squareMeters,
          propertyType: extractedMetadata.propertyType,
          areaId,
        }),
        aiResponseError: null,
        aiMetadataUpdatedAt: new Date(),
      });
    } catch (error: unknown) {
      const aiResponseError = this.formatAiResponseError(error);

      this.logger.warn(
        `AI metadata extraction failed for propertyId=${propertyId}`,
        aiResponseError,
      );

      saved = await this.propertyRepository.save({
        ...property,
        aiResponseError,
        aiMetadataUpdatedAt: new Date(),
      });
    }

    const withArea = await this.propertyRepository.findOne({
      where: { id: saved.id },
      relations: ['area'],
    });

    return {
      ...(withArea ?? saved),
      areaName: withArea?.area?.name ?? null,
    };
  }

  async updatePropertiesFromAi(properties: Property[]): Promise<Property[]> {
    if (properties.length === 0) {
      return [];
    }

    const activeAreaNames = await this.areasService.listActiveNames();
    let extractedMetadataByProperty: (ExtractedPropertyMetadata | null)[];
    let aiResponseError: string | null = null;

    try {
      extractedMetadataByProperty =
        await this.propertyMetadataExtractionService.extractMany(
          properties,
          activeAreaNames,
        );
    } catch (error: unknown) {
      aiResponseError = this.formatAiResponseError(error);
      this.logger.warn(
        `AI batch metadata extraction failed for a batch of ${properties.length} properties`,
        aiResponseError,
      );
      extractedMetadataByProperty = properties.map(() => null);
    }

    const updatedProperties: Property[] = [];

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      const extractedMetadata = extractedMetadataByProperty[i];

      if (!extractedMetadata) {
        updatedProperties.push(
          await this.propertyRepository.save({
            ...property,
            aiResponseError,
            aiMetadataUpdatedAt: new Date(),
          }),
        );
        continue;
      }

      const areaId = await this.resolveAreaId(extractedMetadata.areaName);

      updatedProperties.push(
        await this.propertyRepository.save({
          ...property,
          ...this.buildAiFieldPatch(property, {
            priceAmount: extractedMetadata.priceAmount,
            priceCurrency: extractedMetadata.priceCurrency,
            squareMeters: extractedMetadata.squareMeters,
            propertyType: extractedMetadata.propertyType,
            areaId,
          }),
          aiResponseError: null,
          aiMetadataUpdatedAt: new Date(),
        }),
      );
    }

    return updatedProperties;
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
