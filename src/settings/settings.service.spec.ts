import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from './settings.service';
import { AppSettings, APP_SETTINGS_SINGLETON_ID } from './app-settings.entity';

describe('SettingsService', () => {
  let service: SettingsService;
  let repository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: getRepositoryToken(AppSettings),
          useValue: repository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('getAiProvider', () => {
    it('defaults to GEMINI when no settings row exists yet', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.getAiProvider();

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: APP_SETTINGS_SINGLETON_ID },
      });
      expect(result).toBe('GEMINI');
    });

    it('returns the persisted provider when a settings row exists', async () => {
      repository.findOne.mockResolvedValue({
        id: APP_SETTINGS_SINGLETON_ID,
        aiProvider: 'GROQ',
      } as AppSettings);

      const result = await service.getAiProvider();

      expect(result).toBe('GROQ');
    });
  });

  describe('updateAiProvider', () => {
    it('persists a valid switch when the target API key is configured', async () => {
      configService.get.mockReturnValue('groq-test-key');
      repository.save.mockResolvedValue({
        id: APP_SETTINGS_SINGLETON_ID,
        aiProvider: 'GROQ',
      } as AppSettings);

      const result = await service.updateAiProvider('GROQ');

      expect(configService.get).toHaveBeenCalledWith('GROQ_API_KEY');
      expect(repository.save).toHaveBeenCalledWith({
        id: APP_SETTINGS_SINGLETON_ID,
        aiProvider: 'GROQ',
      });
      expect(result).toBe('GROQ');
    });

    it('rejects a switch when the target provider API key env var is missing', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(service.updateAiProvider('GROQ')).rejects.toThrow(
        'Cannot switch to GROQ: GROQ_API_KEY is not configured',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a switch when the target provider API key env var is empty', async () => {
      configService.get.mockReturnValue('');

      await expect(service.updateAiProvider('GEMINI')).rejects.toThrow(
        'Cannot switch to GEMINI: GEMINI_API_KEY is not configured',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a value that is not a known AI Provider', async () => {
      await expect(service.updateAiProvider('OPENAI' as never)).rejects.toThrow(
        'Invalid AI Provider "OPENAI"',
      );
      expect(configService.get).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
