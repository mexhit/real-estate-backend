import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGenerationOptions, AiProvider } from './ai-provider.interface';

type GoogleGenAiModule = typeof import('@google/genai');
type GoogleGenAiClient = InstanceType<GoogleGenAiModule['GoogleGenAI']>;

@Injectable()
export class GeminiAiProviderService implements AiProvider {
  private readonly logger = new Logger(GeminiAiProviderService.name);
  private readonly model: string;
  private readonly apiKey: string | null;
  private client: GoogleGenAiClient | null = null;
  private clientPromise: Promise<GoogleGenAiClient | null> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? null;
    this.model = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.0-flash',
    );
  }

  async generateText(
    prompt: string,
    options?: AiGenerationOptions,
  ): Promise<string | null> {
    const client = await this.getClient();

    if (!client) {
      return null;
    }

    try {
      const response = await client.models.generateContent({
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

  private async getClient(): Promise<GoogleGenAiClient | null> {
    if (!this.apiKey) {
      return null;
    }

    if (this.client) {
      return this.client;
    }

    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }

    return this.clientPromise;
  }

  private async createClient(): Promise<GoogleGenAiClient | null> {
    try {
      const dynamicImport = new Function(
        'specifier',
        'return import(specifier)',
      ) as (specifier: string) => Promise<GoogleGenAiModule>;
      const { GoogleGenAI } = await dynamicImport('@google/genai');

      this.client = new GoogleGenAI({ apiKey: this.apiKey as string });
      return this.client;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider error';
      this.logger.warn(`Failed to initialize Gemini provider: ${message}`);
      this.clientPromise = null;
      return null;
    }
  }
}
