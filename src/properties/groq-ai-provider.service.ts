import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGenerationOptions, AiProvider } from './ai-provider.interface';

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

@Injectable()
export class GroqAiProviderService implements AiProvider {
  private readonly logger = new Logger(GroqAiProviderService.name);
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly serviceTier: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GROQ_API_KEY') ?? null;
    this.model = this.configService.get<string>(
      'GROQ_MODEL',
      'llama-3.1-8b-instant',
    );
    this.maxRetries = Math.max(
      0,
      Number(this.configService.get<string>('GROQ_MAX_RETRIES', '2')),
    );
    this.retryDelayMs = Math.max(
      0,
      Number(this.configService.get<string>('GROQ_RETRY_DELAY_MS', '1000')),
    );
    this.serviceTier = this.configService.get<string>(
      'GROQ_SERVICE_TIER',
      'on_demand',
    );
    this.baseUrl = this.configService.get<string>(
      'GROQ_BASE_URL',
      'https://api.groq.com/openai/v1',
    );
  }

  async generateText(
    prompt: string,
    options?: AiGenerationOptions,
  ): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            service_tier: this.serviceTier,
            temperature: 0,
            messages: [
              {
                role: 'system',
                content:
                  'You are a structured data extraction API. Return only valid JSON.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            response_format:
              options?.responseMimeType === 'application/json'
                ? { type: 'json_object' }
                : undefined,
          }),
        });

        if (!response.ok) {
          if (
            this.isRetryableStatus(response.status) &&
            attempt < this.maxRetries
          ) {
            const delayMs = this.retryDelayMs * Math.pow(2, attempt);
            this.logger.warn(
              `Groq request failed with status ${response.status}. Retrying in ${delayMs}ms (${attempt + 1}/${this.maxRetries})`,
            );
            await this.sleep(delayMs);
            continue;
          }

          this.logger.warn(
            `Groq request failed with status ${response.status}`,
          );
          return null;
        }

        const body =
          (await response.json()) as GroqChatCompletionResponse | null;
        return body?.choices?.[0]?.message?.content?.trim() ?? null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown provider error';

        if (attempt < this.maxRetries) {
          const delayMs = this.retryDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `Groq request threw an error: ${message}. Retrying in ${delayMs}ms (${attempt + 1}/${this.maxRetries})`,
          );
          await this.sleep(delayMs);
          continue;
        }

        this.logger.warn(`AI provider request failed: ${message}`);
        return null;
      }
    }

    return null;
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
