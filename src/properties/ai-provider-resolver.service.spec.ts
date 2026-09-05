import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from '../settings/settings.service';
import { AI_PROVIDER } from './ai-provider.interface';
import { AiProviderResolver } from './ai-provider-resolver.service';
import { GEMINI_2_PROVIDER, GEMINI_PROVIDER } from './gemini-ai-provider.service';
import { GroqAiProviderService } from './groq-ai-provider.service';
import { PropertyMetadataExtractionService } from './property-metadata-extraction.service';

describe('AiProviderResolver', () => {
  let resolver: AiProviderResolver;
  let extractionService: PropertyMetadataExtractionService;
  let settingsService: { getAiProvider: jest.Mock };
  let geminiAiProviderService: { generateText: jest.Mock };
  let gemini2AiProviderService: { generateText: jest.Mock };
  let groqAiProviderService: { generateText: jest.Mock };

  beforeEach(async () => {
    settingsService = { getAiProvider: jest.fn() };
    geminiAiProviderService = { generateText: jest.fn() };
    gemini2AiProviderService = { generateText: jest.fn() };
    groqAiProviderService = { generateText: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProviderResolver,
        PropertyMetadataExtractionService,
        { provide: SettingsService, useValue: settingsService },
        { provide: GEMINI_PROVIDER, useValue: geminiAiProviderService },
        { provide: GEMINI_2_PROVIDER, useValue: gemini2AiProviderService },
        { provide: GroqAiProviderService, useValue: groqAiProviderService },
        { provide: AI_PROVIDER, useExisting: AiProviderResolver },
      ],
    }).compile();

    resolver = module.get<AiProviderResolver>(AiProviderResolver);
    extractionService = module.get<PropertyMetadataExtractionService>(
      PropertyMetadataExtractionService,
    );
  });

  it('dispatches to Gemini when the setting is GEMINI', async () => {
    settingsService.getAiProvider.mockResolvedValue('GEMINI');
    geminiAiProviderService.generateText.mockResolvedValue('gemini-response');

    const result = await resolver.generateText('prompt', {
      responseMimeType: 'application/json',
    });

    expect(result).toBe('gemini-response');
    expect(geminiAiProviderService.generateText).toHaveBeenCalledWith(
      'prompt',
      { responseMimeType: 'application/json' },
    );
    expect(gemini2AiProviderService.generateText).not.toHaveBeenCalled();
    expect(groqAiProviderService.generateText).not.toHaveBeenCalled();
  });

  it('dispatches to the second Gemini account when the setting is GEMINI_2', async () => {
    settingsService.getAiProvider.mockResolvedValue('GEMINI_2');
    gemini2AiProviderService.generateText.mockResolvedValue('gemini-2-response');

    const result = await resolver.generateText('prompt');

    expect(result).toBe('gemini-2-response');
    expect(gemini2AiProviderService.generateText).toHaveBeenCalledWith(
      'prompt',
      undefined,
    );
    expect(geminiAiProviderService.generateText).not.toHaveBeenCalled();
    expect(groqAiProviderService.generateText).not.toHaveBeenCalled();
  });

  it('dispatches to Groq when the setting is GROQ', async () => {
    settingsService.getAiProvider.mockResolvedValue('GROQ');
    groqAiProviderService.generateText.mockResolvedValue('groq-response');

    const result = await resolver.generateText('prompt');

    expect(result).toBe('groq-response');
    expect(groqAiProviderService.generateText).toHaveBeenCalledWith(
      'prompt',
      undefined,
    );
    expect(geminiAiProviderService.generateText).not.toHaveBeenCalled();
  });

  it('reads the setting fresh on every single extract() call', async () => {
    settingsService.getAiProvider
      .mockResolvedValueOnce('GEMINI')
      .mockResolvedValueOnce('GROQ');
    geminiAiProviderService.generateText.mockResolvedValue('gemini-response');
    groqAiProviderService.generateText.mockResolvedValue('groq-response');

    await expect(resolver.generateText('prompt-1')).resolves.toBe(
      'gemini-response',
    );
    await expect(resolver.generateText('prompt-2')).resolves.toBe(
      'groq-response',
    );

    expect(settingsService.getAiProvider).toHaveBeenCalledTimes(2);
  });

  it('reads the setting exactly once per extractMany invocation, not once per property', async () => {
    settingsService.getAiProvider.mockResolvedValue('GROQ');
    groqAiProviderService.generateText.mockResolvedValue(
      JSON.stringify([
        {
          index: 0,
          priceAmount: null,
          priceCurrency: null,
          squareMeters: null,
          propertyType: null,
          area: null,
        },
        {
          index: 1,
          priceAmount: null,
          priceCurrency: null,
          squareMeters: null,
          propertyType: null,
          area: null,
        },
      ]),
    );

    await extractionService.extractMany([
      { title: 'Apartment 1', description: '', price: '', url: '' },
      { title: 'Apartment 2', description: '', price: '', url: '' },
    ]);

    expect(settingsService.getAiProvider).toHaveBeenCalledTimes(1);
    expect(groqAiProviderService.generateText).toHaveBeenCalledTimes(1);
  });
});
