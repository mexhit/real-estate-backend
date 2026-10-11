import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DecisionProvider, YesNoCriteria } from './decision-provider.interface';

type JevSystemOneResponse = {
  answers?: Record<string, { type?: string; noul?: unknown } | undefined>;
};

const QUESTION_KEY = 'answer';

@Injectable()
export class JevAiProviderService implements DecisionProvider {
  private readonly logger = new Logger(JevAiProviderService.name);
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('JEV_API_KEY') ?? null;
    this.model = this.configService.get<string>('JEV_MODEL', 'jev-latest');
    this.maxRetries = Math.max(
      0,
      Number(this.configService.get<string>('JEV_MAX_RETRIES', '2')),
    );
    this.retryDelayMs = Math.max(
      0,
      Number(this.configService.get<string>('JEV_RETRY_DELAY_MS', '1000')),
    );
    this.baseUrl = this.configService.get<string>(
      'JEV_BASE_URL',
      'https://api.typesafe.ai',
    );
  }

  async decideYesNo(
    state: string,
    instructions: string,
    criteria: YesNoCriteria,
  ): Promise<number | null> {
    if (!this.apiKey) {
      return null;
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/v1/systemone`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            state,
            questions: {
              [QUESTION_KEY]: { type: 'noul', instructions, criteria },
            },
          }),
        });

        if (!response.ok) {
          if (
            this.isRetryableStatus(response.status) &&
            attempt < this.maxRetries
          ) {
            const delayMs = this.retryDelayMs * Math.pow(2, attempt);
            this.logger.warn(
              `JEV request failed with status ${response.status}. Retrying in ${delayMs}ms (${attempt + 1}/${this.maxRetries})`,
            );
            await this.sleep(delayMs);
            continue;
          }

          throw new JevRequestError(response.status);
        }

        const body = (await response.json()) as JevSystemOneResponse | null;
        const probability = body?.answers?.[QUESTION_KEY]?.noul;

        return typeof probability === 'number' &&
          Number.isFinite(probability) &&
          probability >= 0 &&
          probability <= 1
          ? probability
          : null;
      } catch (error) {
        if (error instanceof JevRequestError) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const message =
            error instanceof Error ? error.message : 'Unknown provider error';
          const delayMs = this.retryDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `JEV request threw an error: ${message}. Retrying in ${delayMs}ms (${attempt + 1}/${this.maxRetries})`,
          );
          await this.sleep(delayMs);
          continue;
        }

        throw error;
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

class JevRequestError extends Error {
  constructor(status: number) {
    super(`JEV request failed with status ${status}`);
  }
}
