import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './property.entity';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';
import { AI_PROVIDER } from './ai-provider.interface';
import { GeminiAiProviderService } from './gemini-ai-provider.service';
import { GroqAiProviderService } from './groq-ai-provider.service';
import { AiProviderResolver } from './ai-provider-resolver.service';
import { PropertyAiEnrichmentJob } from './property-ai-enrichment.job';
import { AreasModule } from '../areas/areas.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Property]), AreasModule, SettingsModule],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    PropertyAiEnrichmentJob,
    PropertyMetadataExtractionService,
    GeminiAiProviderService,
    GroqAiProviderService,
    AiProviderResolver,
    {
      provide: AI_PROVIDER,
      useExisting: AiProviderResolver,
    },
  ],
})
export class PropertiesModule {}
