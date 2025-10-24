import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './property.entity';
import { In } from 'typeorm';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
  ) {}

  async getProperties(page: number, limit: number) {
    const whereSql = '';
    const params: any[] = [];
    const paramIndex = 1;

    const query = `
      WITH ranked_properties AS (
        SELECT
          property.*,
          COUNT(*) OVER (PARTITION BY property."providerId") as provider_property_count,
          ROW_NUMBER() OVER (PARTITION BY property."providerId" ORDER BY property.id DESC) as rn
        FROM property
               ${whereSql}
      )
      SELECT *
      FROM ranked_properties
      WHERE rn = 1
      /*ORDER BY provider_property_count DESC, id DESC*/
        ORDER BY id DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, (page - 1) * limit);

    const countQuery = `
      WITH ranked_properties AS (
        SELECT
          property.id,
          ROW_NUMBER() OVER (PARTITION BY property."providerId" ORDER BY property.id DESC) as rn
        FROM property
               ${whereSql}
      )
      SELECT COUNT(*) as total
      FROM ranked_properties
      WHERE rn = 1
    `;

    const data = await this.propertyRepository.query(query, params);

    const [{ total }] = await this.propertyRepository.query(countQuery);

    const enrichedData = data.map((entity) => ({
      ...entity,
      providerPropertyCount: Number(entity.provider_property_count || 0),
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

  createProperty(property: Property): Promise<Property> {
    return this.propertyRepository.save(property);
  }

  async markPropertiesAsSeen(ids: number[]): Promise<void> {
    if (!ids || ids.length === 0) return;

    await this.propertyRepository.update({ id: In(ids) }, { seen: true });
  }
}
