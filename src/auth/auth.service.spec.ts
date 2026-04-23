import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../users/user-role';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const user = {
    id: 1,
    email: 'admin@example.com',
    passwordHash: '',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.Admin,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const usersService = {
    findByEmail: jest.fn(),
    toResponse: jest.fn(({ passwordHash, ...safeUser }) => safeUser),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    user.passwordHash = await bcrypt.hash('admin123', 4);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('returns a token and safe user for valid credentials', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.login({ email: 'ADMIN@example.com ', password: 'admin123' }),
    ).resolves.toEqual({
      accessToken: 'signed-token',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
    expect(usersService.findByEmail).toHaveBeenCalledWith('admin@example.com');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  });

  it('rejects invalid credentials', async () => {
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      service.login({ email: user.email, password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
