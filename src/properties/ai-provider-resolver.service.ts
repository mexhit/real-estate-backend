import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { AiProviderType } from '../settings/app-settings.entity';
import { AiGenerationOptions, AiProvider } from './ai-provider.interface';
import { GeminiAiProviderService } from './gemini-ai-provider.service';
import { GroqAiProviderService } from './groq-ai-provider.service';

@Injectable()
export class AiProviderResolver implements AiProvider {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly geminiAiProviderService: GeminiAiProviderService,
    private readonly groqAiProviderService: GroqAiProviderService,
  ) {}

  async generateText(
    prompt: string,
    options?: AiGenerationOptions,
  ): Promise<string | null> {
    const aiProvider = await this.settingsService.getAiProvider();

    return this.resolve(aiProvider).generateText(prompt, options);
  }

  private resolve(aiProvider: AiProviderType): AiProvider {
    return aiProvider === 'GROQ'
      ? this.groqAiProviderService
      : this.geminiAiProviderService;
  }
}
