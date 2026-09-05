import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { AreasService } from './areas.service';
import { Area } from './area.entity';
import { Property } from '../properties/property.entity';

describe('AreasService', () => {
  let service: AreasService;
  let repository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let transactionManager: { update: jest.Mock };

  beforeEach(async () => {
    transactionManager = {
      update: jest.fn(),
    };
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      manager: {
        transaction: jest.fn(
          async (fn: (manager: typeof transactionManager) => unknown) =>
            fn(transactionManager),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasService,
        {
          provide: getRepositoryToken(Area),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<AreasService>(AreasService);
  });

  describe('findOrCreate', () => {
    it('normalizes the raw name into a key and matches an existing non-deleted Area', async () => {
      const existing = { id: 1, name: 'Blloku', key: 'blloku' } as Area;
      repository.findOne.mockResolvedValue(existing);

      const result = await service.findOrCreate(' blloku ');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { key: 'blloku', deletedAt: IsNull() },
      });
      expect(repository.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('creates a new Area when no non-deleted Area matches the key', async () => {
      repository.findOne.mockResolvedValue(null);
      const created = {
        id: 2,
        name: 'Tirana e Re',
        key: 'tirana-e-re',
      } as Area;
      repository.save.mockResolvedValue(created);

      const result = await service.findOrCreate('Tirana e Re');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { key: 'tirana-e-re', deletedAt: IsNull() },
      });
      expect(repository.save).toHaveBeenCalledWith({
        name: 'Tirana e Re',
        key: 'tirana-e-re',
      });
      expect(result).toBe(created);
    });

    it('allows a new Area to reuse the key of a previously soft-deleted Area', async () => {
      repository.findOne.mockResolvedValue(null);
      const created = { id: 3, name: 'Blloku', key: 'blloku' } as Area;
      repository.save.mockResolvedValue(created);

      const result = await service.findOrCreate('Blloku');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { key: 'blloku', deletedAt: IsNull() },
      });
      expect(result).toBe(created);
    });
  });

  describe('listActiveNames', () => {
    it('excludes soft-deleted Areas and returns just their names', async () => {
      repository.find.mockResolvedValue([
        { id: 1, name: 'Blloku' },
        { id: 2, name: 'Tirana e Re' },
      ] as Area[]);

      const names = await service.listActiveNames();

      expect(repository.find).toHaveBeenCalledWith({
        where: { deletedAt: IsNull() },
        order: { name: 'ASC' },
      });
      expect(names).toEqual(['Blloku', 'Tirana e Re']);
    });
  });

  describe('listActive', () => {
    it('excludes soft-deleted Areas', async () => {
      const areas = [{ id: 1, name: 'Blloku' }] as Area[];
      repository.find.mockResolvedValue(areas);

      const result = await service.listActive();

      expect(repository.find).toHaveBeenCalledWith({
        where: { deletedAt: IsNull() },
        order: { name: 'ASC' },
      });
      expect(result).toBe(areas);
    });
  });

  describe('findOne', () => {
    it('returns the non-deleted Area', async () => {
      const area = { id: 1, name: 'Blloku' } as Area;
      repository.findOne.mockResolvedValue(area);

      await expect(service.findOne(1)).resolves.toBe(area);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: IsNull() },
      });
    });

    it('throws when no non-deleted Area matches the id', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(404)).rejects.toThrow(
        'Area with id 404 not found',
      );
    });
  });

  describe('create', () => {
    it('trims the name and derives the key before saving', async () => {
      const created = { id: 1, name: 'Blloku', key: 'blloku' } as Area;
      repository.save.mockResolvedValue(created);

      const result = await service.create(' Blloku ');

      expect(repository.save).toHaveBeenCalledWith({
        name: 'Blloku',
        key: 'blloku',
      });
      expect(result).toBe(created);
    });
  });

  describe('rename', () => {
    it('updates the name and re-derives the key without affecting linked Property Listings', async () => {
      const area = { id: 1, name: 'Bloku', key: 'bloku' } as Area;
      repository.findOne.mockResolvedValue(area);
      repository.save.mockImplementation(async (payload) => payload);

      const result = await service.rename(1, ' Blloku ');

      expect(repository.save).toHaveBeenCalledWith({
        ...area,
        name: 'Blloku',
        key: 'blloku',
      });
      expect(result).toMatchObject({ name: 'Blloku', key: 'blloku' });
    });

    it('throws when renaming a missing Area', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.rename(404, 'New Name')).rejects.toThrow(
        'Area with id 404 not found',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws when the new name is blank', async () => {
      const area = { id: 1, name: 'Blloku', key: 'blloku' } as Area;
      repository.findOne.mockResolvedValue(area);

      await expect(service.rename(1, '   ')).rejects.toThrow(
        'Area name is required',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws a Conflict when the new name collides with another Area', async () => {
      const area = { id: 1, name: 'Blloku', key: 'blloku' } as Area;
      repository.findOne.mockResolvedValue(area);
      repository.save.mockRejectedValue({ code: '23505' });

      await expect(service.rename(1, 'Tirana e Re')).rejects.toThrow(
        'An area with this name already exists',
      );
    });
  });

  describe('deleteAndReassign', () => {
    it('reassigns Property Listings to the target Area then soft-deletes the source Area, atomically', async () => {
      const area = { id: 1, name: 'Blloku' } as Area;
      const targetArea = { id: 2, name: 'Tirana e Re' } as Area;
      repository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 1) return area;
        if (where.id === 2) return targetArea;
        return null;
      });

      await service.deleteAndReassign(1, 2);

      expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
      expect(transactionManager.update).toHaveBeenCalledWith(
        Property,
        { areaId: 1 },
        { areaId: 2 },
      );
      expect(transactionManager.update).toHaveBeenCalledWith(
        Area,
        { id: 1 },
        { deletedAt: expect.any(Date) },
      );
    });

    it('throws when reassignToAreaId is missing', async () => {
      await expect(
        service.deleteAndReassign(1, undefined as unknown as number),
      ).rejects.toThrow('reassignToAreaId is required');
      expect(repository.manager.transaction).not.toHaveBeenCalled();
    });

    it('throws when reassignToAreaId is the same Area being deleted', async () => {
      await expect(service.deleteAndReassign(1, 1)).rejects.toThrow(
        'Cannot reassign properties to the Area being deleted',
      );
      expect(repository.manager.transaction).not.toHaveBeenCalled();
    });

    it('throws when the Area being deleted is missing', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.deleteAndReassign(404, 2)).rejects.toThrow(
        'Area with id 404 not found',
      );
      expect(repository.manager.transaction).not.toHaveBeenCalled();
    });

    it('throws when the target Area is missing', async () => {
      const area = { id: 1, name: 'Blloku' } as Area;
      repository.findOne.mockImplementation(async ({ where }) => {
        if (where.id === 1) return area;
        return null;
      });

      await expect(service.deleteAndReassign(1, 404)).rejects.toThrow(
        'Area with id 404 not found',
      );
      expect(repository.manager.transaction).not.toHaveBeenCalled();
    });
  });
});
