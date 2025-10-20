import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './property.entity';

interface PropertyFilters {
  providerId?: string;
}

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
  ) {}

  async getProperties(
    page: number,
    limit: number,
    filters: PropertyFilters = {},
  ) {
    const { providerId } = filters;

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
}
