import { Body, Controller, Get, Post } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  getProperties() {
    return this.propertiesService.getProperties();
  }

  @Post()
  createProperty(@Body() property: Property) {
    return this.propertiesService.createProperty(property);
  }
}
