import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AI_PROVIDER_TYPES,
  AiProviderType,
  APP_SETTINGS_SINGLETON_ID,
  AppSettings,
  DEFAULT_AI_PROVIDER,
} from './app-settings.entity';

const API_KEY_ENV_VAR_BY_PROVIDER: Record<AiProviderType, string> = {
  GEMINI: 'GEMINI_API_KEY',
  GEMINI_2: 'GEMINI_API_KEY_2',
  GROQ: 'GROQ_API_KEY',
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly appSettingsRepository: Repository<AppSettings>,
    private readonly configService: ConfigService,
  ) {}

  async getAiProvider(): Promise<AiProviderType> {
    const settings = await this.appSettingsRepository.findOne({
      where: { id: APP_SETTINGS_SINGLETON_ID },
    });

    return settings?.aiProvider ?? DEFAULT_AI_PROVIDER;
  }

  async updateAiProvider(aiProvider: AiProviderType): Promise<AiProviderType> {
    if (!AI_PROVIDER_TYPES.includes(aiProvider)) {
      throw new BadRequestException(
        `Invalid AI Provider "${aiProvider}". Must be one of: ${AI_PROVIDER_TYPES.join(', ')}`,
      );
    }

    const envVar = API_KEY_ENV_VAR_BY_PROVIDER[aiProvider];
    const apiKey = this.configService.get<string>(envVar);

    if (!apiKey) {
      throw new BadRequestException(
        `Cannot switch to ${aiProvider}: ${envVar} is not configured`,
      );
    }

    await this.appSettingsRepository.save({
      id: APP_SETTINGS_SINGLETON_ID,
      aiProvider,
    });

    return aiProvider;
  }
}
