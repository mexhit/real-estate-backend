import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './property.entity';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';
import { AI_PROVIDER } from './ai-provider.interface';
import {
  createGeminiAiProviderConfig,
  GEMINI_2_PROVIDER,
  GEMINI_PROVIDER,
  GeminiAiProviderService,
} from './gemini-ai-provider.service';
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
    {
      provide: GEMINI_PROVIDER,
      useFactory: (configService: ConfigService) =>
        new GeminiAiProviderService(
          createGeminiAiProviderConfig(configService, 'GEMINI_API_KEY'),
        ),
      inject: [ConfigService],
    },
    {
      provide: GEMINI_2_PROVIDER,
      useFactory: (configService: ConfigService) =>
        new GeminiAiProviderService(
          createGeminiAiProviderConfig(configService, 'GEMINI_API_KEY_2'),
        ),
      inject: [ConfigService],
    },
    GroqAiProviderService,
    AiProviderResolver,
    {
      provide: AI_PROVIDER,
      useExisting: AiProviderResolver,
    },
  ],
})
export class PropertiesModule {}
