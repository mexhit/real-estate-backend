import { UserRole } from '../users/user-role';

export type JwtPayload = {
  sub: number;
  email: string;
  role: UserRole;
};
