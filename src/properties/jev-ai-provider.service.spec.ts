import { ConfigService } from '@nestjs/config';
import { JevAiProviderService } from './jev-ai-provider.service';

describe('JevAiProviderService', () => {
  const originalFetch = global.fetch;
  const criteria = { true: 'furnished', false: 'unfurnished' };

  const createConfigService = (overrides: Record<string, string> = {}) =>
    ({
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          JEV_API_KEY: 'test-key',
          JEV_MAX_RETRIES: '2',
          JEV_RETRY_DELAY_MS: '0',
          ...overrides,
        };

        return values[key] ?? defaultValue;
      }),
    }) as unknown as ConfigService;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the yes probability from a noul answer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answers: { answer: { type: 'noul', noul: 0.87 } } }),
    }) as any;

    const provider = new JevAiProviderService(createConfigService());

    await expect(provider.decideYesNo('state', 'q?', criteria)).resolves.toBe(
      0.87,
    );

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body)).toEqual({
      model: 'jev-latest',
      state: 'state',
      questions: { answer: { type: 'noul', instructions: 'q?', criteria } },
    });
  });

  it('returns null without calling JEV when no API key is configured', async () => {
    global.fetch = jest.fn() as any;
    const provider = new JevAiProviderService(
      createConfigService({ JEV_API_KEY: '' }),
    );
    // empty string is falsy: treated as missing
    await expect(provider.decideYesNo('s', 'q', criteria)).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null for a malformed answer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answers: {} }),
    }) as any;

    const provider = new JevAiProviderService(createConfigService());

    await expect(provider.decideYesNo('s', 'q', criteria)).resolves.toBeNull();
  });

  it('retries on 429 and then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answers: { answer: { noul: 0.1 } } }),
      }) as any;

    const provider = new JevAiProviderService(createConfigService());

    await expect(provider.decideYesNo('s', 'q', criteria)).resolves.toBe(0.1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws without retrying on a non-retryable status', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as any;

    const provider = new JevAiProviderService(createConfigService());

    await expect(provider.decideYesNo('s', 'q', criteria)).rejects.toThrow(
      'JEV request failed with status 401',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
