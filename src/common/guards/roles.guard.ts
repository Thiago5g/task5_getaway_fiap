import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No RBAC requirement for this route
    }

    const req = context.switchToHttp().getRequest();
    const user = (req as any).user as { [key: string]: any } | undefined;
    const groups: string[] = Array.isArray(user?.['cognito:groups'])
      ? (user!['cognito:groups'] as string[])
      : [];

    const hasRole = requiredRoles.some((role) => groups.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
