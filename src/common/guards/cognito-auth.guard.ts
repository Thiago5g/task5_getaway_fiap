import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

type CognitoPayload = JWTPayload & {
  token_use?: 'id' | 'access';
  aud?: string;
  client_id?: string;
  username?: string;
  scope?: string;
};

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private jwks!: ReturnType<typeof createRemoteJWKSet>;
  private issuer!: string;
  private clientId!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const region = this.config.get<string>('COGNITO_REGION');
    const userPoolId = this.config.get<string>('COGNITO_USER_POOL_ID');
    const clientId = this.config.get<string>('COGNITO_CLIENT_ID');

    if (!region || !userPoolId || !clientId) {
      throw new Error(
        'Missing Cognito env vars: COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID',
      );
    }

    this.clientId = clientId;
    this.issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined =
      req.headers['authorization'] || req.headers['Authorization'];

    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.slice('Bearer '.length).trim();

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        algorithms: ['RS256'],
      });

      const p = payload as CognitoPayload;

      // token_use é a forma mais confiável de diferenciar
      if (p.token_use === 'id') {
        // ID token: aud deve ser o clientId
        if (p.aud !== this.clientId) {
          throw new UnauthorizedException('Invalid token audience');
        }
      } else if (p.token_use === 'access') {
        // Access token: geralmente vem client_id
        if (p.client_id !== this.clientId) {
          throw new UnauthorizedException('Invalid token client_id');
        }
      } else {
        throw new UnauthorizedException('Invalid token (missing token_use)');
      }

      (req as any).user = p;
      return true;
    } catch (err) {
      console.error('Cognito token verification failed:', err);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
