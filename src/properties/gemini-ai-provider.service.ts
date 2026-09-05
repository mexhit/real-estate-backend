import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGenerationOptions, AiProvider } from './ai-provider.interface';

type GoogleGenAiModule = typeof import('@google/genai');
type GoogleGenAiClient = InstanceType<GoogleGenAiModule['GoogleGenAI']>;

export const GEMINI_PROVIDER = 'GEMINI_PROVIDER';
export const GEMINI_2_PROVIDER = 'GEMINI_2_PROVIDER';

export type GeminiAiProviderConfig = {
  apiKey: string | null;
  model: string;
  maxRetries: number;
  retryDelayMs: number;
};

export function createGeminiAiProviderConfig(
  configService: ConfigService,
  apiKeyEnvVar: string,
): GeminiAiProviderConfig {
  return {
    apiKey: configService.get<string>(apiKeyEnvVar) ?? null,
    model: configService.get<string>('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
    maxRetries: Math.max(
      0,
      Number(configService.get<string>('GEMINI_MAX_RETRIES', '2')),
    ),
    retryDelayMs: Math.max(
      0,
      Number(configService.get<string>('GEMINI_RETRY_DELAY_MS', '1000')),
    ),
  };
}

@Injectable()
export class GeminiAiProviderService implements AiProvider {
  private readonly logger = new Logger(GeminiAiProviderService.name);
  private readonly model: string;
  private readonly apiKey: string | null;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private client: GoogleGenAiClient | null = null;
  private clientPromise: Promise<GoogleGenAiClient | null> | null = null;

  constructor(config: GeminiAiProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxRetries = config.maxRetries;
    this.retryDelayMs = config.retryDelayMs;
  }

  async generateText(
    prompt: string,
    options?: AiGenerationOptions,
  ): Promise<string | null> {
    const client = await this.getClient();

    if (!client) {
      return null;
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
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
        if (this.isRateLimitError(error) && attempt < this.maxRetries) {
          const delayMs = this.retryDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `Gemini rate limited (429). Retrying in ${delayMs}ms (${attempt + 1}/${this.maxRetries})`,
          );
          await this.sleep(delayMs);
          continue;
        }

        throw error;
      }
    }

    return null;
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
      this.clientPromise = null;
      throw error;
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      message?: unknown;
    };

    return (
      candidate.status === 429 ||
      candidate.statusCode === 429 ||
      candidate.code === 429 ||
      (typeof candidate.message === 'string' &&
        candidate.message.includes('429'))
    );
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
