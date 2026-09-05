import { Inject, Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { AiProviderType } from '../settings/app-settings.entity';
import { AiGenerationOptions, AiProvider } from './ai-provider.interface';
import { GEMINI_2_PROVIDER, GEMINI_PROVIDER } from './gemini-ai-provider.service';
import { GroqAiProviderService } from './groq-ai-provider.service';

@Injectable()
export class AiProviderResolver implements AiProvider {
  constructor(
    private readonly settingsService: SettingsService,
    @Inject(GEMINI_PROVIDER)
    private readonly geminiAiProviderService: AiProvider,
    @Inject(GEMINI_2_PROVIDER)
    private readonly gemini2AiProviderService: AiProvider,
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
    switch (aiProvider) {
      case 'GEMINI':
        return this.geminiAiProviderService;
      case 'GEMINI_2':
        return this.gemini2AiProviderService;
      case 'GROQ':
        return this.groqAiProviderService;
      default: {
        const exhaustiveCheck: never = aiProvider;
        throw new Error(`Unknown AI Provider: ${String(exhaustiveCheck)}`);
      }
    }
  }
}
