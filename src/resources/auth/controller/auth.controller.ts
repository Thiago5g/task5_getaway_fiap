import {
  Body,
  Controller,
  Post,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { Public } from 'src/common/decorators/public.decorator';
import { ApiHeader } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiHeader({ name: 'Authorization', description: 'Bearer <token>' })
  async login(
    @Headers('authorization') authorization?: string,
    @Body() body?: { email?: string; password?: string },
  ) {
    // If a Bearer token is provided, prefer verifying it.
    if (authorization && authorization.startsWith('Bearer ')) {
      return this.authService.loginWithBearerToken(authorization);
    }
    // Fallback: support email/password when configured in Cognito (password grant).
    if (body?.email && body?.password) {
      return this.authService.login(body.email, body.password);
    }
    throw new BadRequestException(
      'Provide Authorization: Bearer <token> header or email/password in body',
    );
  }
}
