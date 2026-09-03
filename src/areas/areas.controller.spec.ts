import { Test, TestingModule } from '@nestjs/testing';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { Area } from './area.entity';

describe('AreasController', () => {
  let controller: AreasController;
  let areasService: {
    listActive: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    rename: jest.Mock;
    softDelete: jest.Mock;
  };

  beforeEach(async () => {
    areasService = {
      listActive: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      rename: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AreasController],
      providers: [
        {
          provide: AreasService,
          useValue: areasService,
        },
      ],
    }).compile();

    controller = module.get<AreasController>(AreasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates listing to AreasService', async () => {
    const areas = [{ id: 1, name: 'Blloku' }] as Area[];
    areasService.listActive.mockResolvedValue(areas);

    await expect(controller.listActive()).resolves.toBe(areas);
    expect(areasService.listActive).toHaveBeenCalledTimes(1);
  });

  it('delegates getting one Area to AreasService', async () => {
    const area = { id: 1, name: 'Blloku' } as Area;
    areasService.findOne.mockResolvedValue(area);

    await expect(controller.findOne(1)).resolves.toBe(area);
    expect(areasService.findOne).toHaveBeenCalledWith(1);
  });

  it('delegates creating an Area to AreasService', async () => {
    const area = { id: 1, name: 'Blloku' } as Area;
    areasService.create.mockResolvedValue(area);

    await expect(controller.create('Blloku')).resolves.toBe(area);
    expect(areasService.create).toHaveBeenCalledWith('Blloku');
  });

  it('delegates renaming an Area to AreasService', async () => {
    const area = { id: 1, name: 'Blloku' } as Area;
    areasService.rename.mockResolvedValue(area);

    await expect(controller.rename(1, 'Blloku')).resolves.toBe(area);
    expect(areasService.rename).toHaveBeenCalledWith(1, 'Blloku');
  });

  it('delegates soft-deleting an Area to AreasService', async () => {
    areasService.softDelete.mockResolvedValue(undefined);

    await controller.softDelete(1);
    expect(areasService.softDelete).toHaveBeenCalledWith(1);
  });
});
