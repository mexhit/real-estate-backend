import { Controller, Get } from '@nestjs/common';

@Controller('properties')
export class PropertiesController {
  @Get()
  getProperties() {
    return 'Properties';
  }
}
