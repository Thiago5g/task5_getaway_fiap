import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { Public } from 'src/common/decorators/public.decorator';
import { LoginDto } from '../dto/login.dto';
import { ApiBody } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiBody({ type: LoginDto })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }
}
