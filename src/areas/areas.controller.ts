import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AreasService } from './areas.service';
import { AreaPriceSnapshotsService } from './area-price-snapshots.service';

@Controller('areas')
export class AreasController {
  constructor(
    private readonly areasService: AreasService,
    private readonly areaPriceSnapshotsService: AreaPriceSnapshotsService,
  ) {}

  @Get()
  listActive() {
    return this.areasService.listActive();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.areasService.findOne(id);
  }

  @Get(':id/contributing-listings')
  getContributingListings(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('highlightProviderId') highlightProviderId?: string,
  ) {
    page = Math.max(1, Number(page));
    limit = Math.min(Math.max(1, Number(limit)), 100);

    return this.areaPriceSnapshotsService.getContributingListings(
      id,
      page,
      limit,
      highlightProviderId,
    );
  }

  @Post()
  create(@Body('name') name: string) {
    return this.areasService.create(name);
  }

  @Put(':id')
  rename(@Param('id', ParseIntPipe) id: number, @Body('name') name: string) {
    return this.areasService.rename(id, name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAndReassign(
    @Param('id', ParseIntPipe) id: number,
    @Body('reassignToAreaId') reassignToAreaId: number,
  ) {
    return this.areasService.deleteAndReassign(id, reassignToAreaId);
  }
}
