import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { PropertiesModule } from '../properties/properties.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [AreasModule, PropertiesModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
