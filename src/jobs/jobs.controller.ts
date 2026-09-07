import { Controller, Param, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post(':name/run')
  run(@Param('name') name: string) {
    return this.jobsService.run(name);
  }
}
