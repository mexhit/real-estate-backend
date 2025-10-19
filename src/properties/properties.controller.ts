import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  async getProperties(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    // Ensure positive integers
    page = Math.max(1, Number(page));
    limit = Math.min(Math.max(1, Number(limit)), 100); // cap at 100 for safety

    return this.propertiesService.getProperties(page, limit);
  }

  @Post()
  createProperty(@Body() property: Property) {
    return this.propertiesService.createProperty(property);
  }
}
