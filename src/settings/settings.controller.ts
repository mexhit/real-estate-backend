import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AiProviderType } from './app-settings.entity';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('ai-provider')
  async getAiProvider(): Promise<{ aiProvider: AiProviderType }> {
    return { aiProvider: await this.settingsService.getAiProvider() };
  }

  @Patch('ai-provider')
  async updateAiProvider(
    @Body('aiProvider') aiProvider: AiProviderType,
  ): Promise<{ aiProvider: AiProviderType }> {
    return {
      aiProvider: await this.settingsService.updateAiProvider(aiProvider),
    };
  }
}
