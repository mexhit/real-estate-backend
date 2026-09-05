import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Area, normalizeAreaKey } from './area.entity';
import { Property } from '../properties/property.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AreasService {
  constructor(
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
  ) {}

  async findOrCreate(rawName: string): Promise<Area> {
    const name = rawName.trim();
    const key = normalizeAreaKey(name);

    const existing = await this.areaRepository.findOne({
      where: { key, deletedAt: IsNull() },
    });

    if (existing) {
      return existing;
    }

    return this.areaRepository.save({ name, key });
  }

  async listActiveNames(): Promise<string[]> {
    const areas = await this.listActive();

    return areas.map((area) => area.name);
  }

  listActive(): Promise<Area[]> {
    return this.areaRepository.find({
      where: { deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Area> {
    const area = await this.areaRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!area) {
      throw new NotFoundException(`Area with id ${id} not found`);
    }

    return area;
  }

  async create(name: string): Promise<Area> {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new BadRequestException('Area name is required');
    }

    try {
      return await this.areaRepository.save({
        name: trimmed,
        key: normalizeAreaKey(trimmed),
      });
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('An area with this name already exists');
      }

      throw err;
    }
  }

  async rename(id: number, name: string): Promise<Area> {
    const area = await this.findOne(id);
    const trimmed = name.trim();

    if (!trimmed) {
      throw new BadRequestException('Area name is required');
    }

    try {
      return await this.areaRepository.save({
        ...area,
        name: trimmed,
        key: normalizeAreaKey(trimmed),
      });
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('An area with this name already exists');
      }

      throw err;
    }
  }

  async deleteAndReassign(
    id: number,
    reassignToAreaId: number,
  ): Promise<void> {
    if (reassignToAreaId == null) {
      throw new BadRequestException('reassignToAreaId is required');
    }

    if (reassignToAreaId === id) {
      throw new BadRequestException(
        'Cannot reassign properties to the Area being deleted',
      );
    }

    const area = await this.findOne(id);
    const targetArea = await this.findOne(reassignToAreaId);

    await this.areaRepository.manager.transaction(async (manager) => {
      await manager.update(
        Property,
        { areaId: area.id },
        { areaId: targetArea.id },
      );
      await manager.update(Area, { id: area.id }, { deletedAt: new Date() });
    });
  }
}
