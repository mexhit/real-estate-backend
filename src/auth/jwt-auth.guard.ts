import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { ALLOW_API_KEY } from './api-key.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const allowsApiKey = this.reflector.getAllAndOverride<boolean>(
      ALLOW_API_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowsApiKey && this.hasValidApiKey(context)) {
      return true;
    }

    return super.canActivate(context);
  }

  private hasValidApiKey(context: ExecutionContext): boolean {
    const expectedApiKey = this.configService.get<string>(
      'PROPERTY_INGEST_API_KEY',
    );

    if (!expectedApiKey) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedApiKey = request.header('x-api-key');

    if (!providedApiKey) {
      return false;
    }

    return this.safeCompare(providedApiKey, expectedApiKey);
  }

  private safeCompare(value: string, expectedValue: string): boolean {
    const valueBuffer = Buffer.from(value);
    const expectedValueBuffer = Buffer.from(expectedValue);

    if (valueBuffer.length !== expectedValueBuffer.length) {
      return false;
    }

    return timingSafeEqual(valueBuffer, expectedValueBuffer);
  }
}
