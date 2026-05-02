import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiGenerationOptions, AiProvider } from './ai-provider.interface';

@Injectable()
export class GeminiAiProviderService implements AiProvider {
  private readonly logger = new Logger(GeminiAiProviderService.name);
  private readonly client: GoogleGenAI | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    this.model = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.0-flash',
    );
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  async generateText(
    prompt: string,
    options?: AiGenerationOptions,
  ): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: options?.responseMimeType,
        },
      });

      return response.text?.trim() ?? null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      this.logger.warn(`AI provider request failed: ${message}`);
      return null;
    }
  }
}
