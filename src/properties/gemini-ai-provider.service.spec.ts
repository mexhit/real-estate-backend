import { ConfigService } from '@nestjs/config';
import { GeminiAiProviderService } from './gemini-ai-provider.service';

describe('GeminiAiProviderService', () => {
  const createConfigService = () =>
    ({
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          GEMINI_API_KEY: 'test-key',
          GEMINI_MODEL: 'gemini-2.0-flash-lite',
          GEMINI_MAX_RETRIES: '2',
          GEMINI_RETRY_DELAY_MS: '0',
        };

        return values[key] ?? defaultValue;
      }),
    }) as unknown as ConfigService;

  it('retries on 429 and returns the later successful response', async () => {
    const service = new GeminiAiProviderService(createConfigService());
    const generateContent = jest
      .fn()
      .mockRejectedValueOnce({ status: 429, message: '429 Too Many Requests' })
      .mockResolvedValueOnce({ text: 'ok' });

    (service as any).client = {
      models: {
        generateContent,
      },
    };

    await expect(service.generateText('prompt')).resolves.toBe('ok');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('returns null when retries are exhausted', async () => {
    const service = new GeminiAiProviderService(createConfigService());
    const generateContent = jest
      .fn()
      .mockRejectedValue({ status: 429, message: '429 Too Many Requests' });

    (service as any).client = {
      models: {
        generateContent,
      },
    };

    await expect(service.generateText('prompt')).resolves.toBeNull();
    expect(generateContent).toHaveBeenCalledTimes(3);
  });
});
