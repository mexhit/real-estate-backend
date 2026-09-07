import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Area } from './area.entity';
import { AreaPriceSnapshot } from './area-price-snapshot.entity';
import { AreasService } from './areas.service';
import { AreasController } from './areas.controller';
import { AreaPriceSnapshotsService } from './area-price-snapshots.service';
import { AreaPriceSnapshotJob } from './area-price-snapshot.job';
import { Property } from '../properties/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Area, AreaPriceSnapshot, Property])],
  controllers: [AreasController],
  providers: [AreasService, AreaPriceSnapshotsService, AreaPriceSnapshotJob],
  exports: [AreasService, AreaPriceSnapshotJob],
})
export class AreasModule {}
