import { ConfigService } from '@nestjs/config';
import { GroqAiProviderService } from './groq-ai-provider.service';

describe('GroqAiProviderService', () => {
  const originalFetch = global.fetch;

  const createConfigService = () =>
    ({
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          GROQ_API_KEY: 'test-key',
          GROQ_MODEL: 'llama-3.1-8b-instant',
          GROQ_MAX_RETRIES: '2',
          GROQ_RETRY_DELAY_MS: '0',
          GROQ_SERVICE_TIER: 'on_demand',
          GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
        };

        return values[key] ?? defaultValue;
      }),
    }) as unknown as ConfigService;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the generated text from Groq chat completions', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"priceAmount":120000}',
            },
          },
        ],
      }),
    }) as any;

    const service = new GroqAiProviderService(createConfigService());
    await expect(
      service.generateText('prompt', { responseMimeType: 'application/json' }),
    ).resolves.toBe('{"priceAmount":120000}');
  });

  it('retries on 429 and then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
        }),
      }) as any;

    const service = new GroqAiProviderService(createConfigService());
    await expect(service.generateText('prompt')).resolves.toBe('ok');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
