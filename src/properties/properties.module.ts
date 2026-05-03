import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './property.entity';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';
import { AI_PROVIDER } from './ai-provider.interface';
import { GroqAiProviderService } from './groq-ai-provider.service';

@Module({
  imports: [TypeOrmModule.forFeature([Property])],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    PropertyMetadataExtractionService,
    GroqAiProviderService,
    {
      provide: AI_PROVIDER,
      useExisting: GroqAiProviderService,
    },
  ],
})
export class PropertiesModule {}
