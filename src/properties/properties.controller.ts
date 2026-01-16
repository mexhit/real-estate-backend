import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  async getProperties(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('onlyUnseen') onlyUnseen: string,
  ) {
    // Ensure positive integers
    page = Math.max(1, Number(page));
    limit = Math.min(Math.max(1, Number(limit)), 100); // cap at 100 for safety
    const fromDateObj = fromDate ? new Date(Number(fromDate)) : undefined;
    const toDateObj = toDate ? new Date(Number(toDate)) : undefined;
    const onlyUnseenBool = onlyUnseen === 'true';

    return this.propertiesService.getProperties(page, limit, {
      fromDate: fromDateObj,
      toDate: toDateObj,
      onlyUnseen: onlyUnseenBool,
    });
  }

  @Get('provider/:providerId')
  async getPropertiesByProviderId(
    @Param('providerId') providerId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    // Ensure positive integers
    page = Math.max(1, Number(page));
    limit = Math.min(Math.max(1, Number(limit)), 100); // cap at 100 for safety

    return this.propertiesService.getPropertiesByProviderId(
      page,
      limit,
      providerId,
    );
  }

  @Put(':id/bookmark/:bookmarked(true|false)')
  bookmarkProperty(
    @Param('id') id: number,
    @Param('bookmarked') bookmarked: string,
  ) {
    const bookmarkedBool = bookmarked === 'true';

    return this.propertiesService.bookmarkProperty(id, bookmarkedBool);
  }

  @Post()
  createProperty(@Body() property: Property) {
    return this.propertiesService.createProperty(property);
  }
}
