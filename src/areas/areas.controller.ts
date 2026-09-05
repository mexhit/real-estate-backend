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
} from '@nestjs/common';
import { AreasService } from './areas.service';

@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  listActive() {
    return this.areasService.listActive();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.areasService.findOne(id);
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
