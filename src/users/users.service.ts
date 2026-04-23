import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserResponse } from './user-response.type';
import { UserRole } from './user-role';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureAdminUser();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  toResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async ensureAdminUser(): Promise<void> {
    const email = this.configService
      .get<string>('ADMIN_EMAIL', 'admin@example.com')
      .toLowerCase()
      .trim();
    const existingAdmin = await this.findByEmail(email);

    if (existingAdmin) {
      return;
    }

    const password = this.configService.get<string>(
      'ADMIN_PASSWORD',
      'admin123',
    );
    const firstName = this.configService.get<string>(
      'ADMIN_FIRST_NAME',
      'Admin',
    );
    const lastName = this.configService.get<string>('ADMIN_LAST_NAME', 'User');
    const passwordHash = await bcrypt.hash(password, 12);

    await this.userRepository.save({
      email,
      passwordHash,
      firstName,
      lastName,
      role: UserRole.Admin,
      isActive: true,
    });
  }
}
