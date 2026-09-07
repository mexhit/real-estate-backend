import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [AreasModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
