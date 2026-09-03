import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Area, normalizeAreaKey } from './area.entity';

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

  create(name: string): Promise<Area> {
    const trimmed = name.trim();

    return this.areaRepository.save({
      name: trimmed,
      key: normalizeAreaKey(trimmed),
    });
  }

  async rename(id: number, name: string): Promise<Area> {
    const area = await this.findOne(id);
    const trimmed = name.trim();

    return this.areaRepository.save({
      ...area,
      name: trimmed,
      key: normalizeAreaKey(trimmed),
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.findOne(id);
    await this.areaRepository.update({ id }, { deletedAt: new Date() });
  }
}
