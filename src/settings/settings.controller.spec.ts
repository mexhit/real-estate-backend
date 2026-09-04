import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  let settingsService: {
    getAiProvider: jest.Mock;
    updateAiProvider: jest.Mock;
  };

  beforeEach(async () => {
    settingsService = {
      getAiProvider: jest.fn(),
      updateAiProvider: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: settingsService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getting the AI Provider to SettingsService', async () => {
    settingsService.getAiProvider.mockResolvedValue('GEMINI');

    await expect(controller.getAiProvider()).resolves.toEqual({
      aiProvider: 'GEMINI',
    });
    expect(settingsService.getAiProvider).toHaveBeenCalledTimes(1);
  });

  it('delegates updating the AI Provider to SettingsService', async () => {
    settingsService.updateAiProvider.mockResolvedValue('GROQ');

    await expect(controller.updateAiProvider('GROQ')).resolves.toEqual({
      aiProvider: 'GROQ',
    });
    expect(settingsService.updateAiProvider).toHaveBeenCalledWith('GROQ');
  });
});
