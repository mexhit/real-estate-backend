import { ConfigService } from '@nestjs/config';
import {
  createGeminiAiProviderConfig,
  GeminiAiProviderService,
} from './gemini-ai-provider.service';

describe('GeminiAiProviderService', () => {
  const createConfigService = (apiKeyEnvVar = 'GEMINI_API_KEY') =>
    ({
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          [apiKeyEnvVar]: 'test-key',
          GEMINI_MODEL: 'gemini-3.5-flash-lite',
          GEMINI_MAX_RETRIES: '2',
          GEMINI_RETRY_DELAY_MS: '0',
        };

        return values[key] ?? defaultValue;
      }),
    }) as unknown as ConfigService;

  const createService = (apiKeyEnvVar = 'GEMINI_API_KEY') =>
    new GeminiAiProviderService(
      createGeminiAiProviderConfig(createConfigService(apiKeyEnvVar), apiKeyEnvVar),
    );

  it('retries on 429 and returns the later successful response', async () => {
    const service = createService();
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

  it('throws when retries are exhausted', async () => {
    const service = createService();
    const error = { status: 429, message: '429 Too Many Requests' };
    const generateContent = jest.fn().mockRejectedValue(error);

    (service as any).client = {
      models: {
        generateContent,
      },
    };

    await expect(service.generateText('prompt')).rejects.toBe(error);
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('reads its API key from whichever env var it is configured with, so a second instance can use a different account', async () => {
    const config = createGeminiAiProviderConfig(
      createConfigService('GEMINI_API_KEY_2'),
      'GEMINI_API_KEY_2',
    );

    expect(config.apiKey).toBe('test-key');
    expect(config.model).toBe('gemini-3.5-flash-lite');
  });
});
