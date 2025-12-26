import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsuarioService } from 'src/resources/usuarios/service/usuario.service';

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';

type CognitoUserInfo = {
  sub: string;
  email?: string;
  name?: string;
};

type CognitoTokenResponse = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  token_type: 'Bearer';
};

@Injectable()
export class AuthService {
  private readonly cognito: CognitoIdentityProviderClient;

  constructor(private readonly userService: UsuarioService) {
    const region = process.env.COGNITO_REGION;
    if (!region) throw new Error('Missing COGNITO_REGION env var');

    this.cognito = new CognitoIdentityProviderClient({ region });
  }

  private get userPoolId() {
    const v = process.env.COGNITO_USER_POOL_ID;
    if (!v) throw new Error('Missing COGNITO_USER_POOL_ID env var');
    return v;
  }

  private get clientId() {
    const v = process.env.COGNITO_CLIENT_ID;
    if (!v) throw new Error('Missing COGNITO_CLIENT_ID env var');
    return v;
  }

  /**
   * Se o App Client tiver secret, o Cognito pode exigir SECRET_HASH
   * em alguns cenários. Esse helper calcula corretamente.
   */
  private getSecretHash(username: string): string | undefined {
    const clientSecret = process.env.COGNITO_CLIENT_SECRET;
    if (!clientSecret) return undefined;

    // SECRET_HASH = Base64(HMAC_SHA256(clientSecret, username + clientId))
    const msg = `${username}${this.clientId}`;
    return createHmac('sha256', clientSecret).update(msg).digest('base64');
  }

  /**
   * Login com email/senha direto no Cognito (USER_PASSWORD_AUTH).
   * -> retorna access_token e também upsert no seu banco local.
   *
   * Observação:
   * - Se o usuário estiver em "FORCE_CHANGE_PASSWORD" pode cair em NEW_PASSWORD_REQUIRED.
   *   Aqui eu retorno erro explicando (você pode implementar fluxo se quiser).
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ access_token: string }> {
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }

    const tokens = await this.getTokensWithUserPasswordAuth(email, password);

    const userInfo = await this.getUserInfoFromCognito(tokens.access_token);

    const normalizedEmail = (userInfo.email ?? '').trim().toLowerCase();
    const nome = (userInfo.name ?? '').trim();

    if (!normalizedEmail) {
      throw new UnauthorizedException('missing email in cognito userinfo');
    }
    if (!nome) {
      // Nem todo pool tem "name". Se você não usa, pode remover essa validação.
      throw new UnauthorizedException('missing name in cognito userinfo');
    }

    await this.userService.upsertFromCognito({
      email: normalizedEmail,
      nome,
      cognitoSub: userInfo.sub,
    });

    return { access_token: tokens.access_token };
  }

  /**
   * Login alternativo: você manda um Bearer token (Access Token do Cognito)
   * e eu valido/consulto o GetUser, upsert no banco e retorno o mesmo token.
   *
   * Isso é útil se você autenticar em outro lugar (Hosted UI, front, etc.)
   */
  async loginWithBearerToken(
    authorizationHeader?: string,
  ): Promise<{ access_token: string }> {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Authorization: Bearer <token> header is required',
      );
    }

    const accessToken = authorizationHeader.substring('Bearer '.length).trim();
    const userInfo = await this.getUserInfoFromCognito(accessToken);

    const normalizedEmail = (userInfo.email ?? '').trim().toLowerCase();
    const nome = (userInfo.name ?? '').trim();

    if (!normalizedEmail) {
      throw new UnauthorizedException('missing email in cognito userinfo');
    }
    if (!nome) {
      throw new UnauthorizedException('missing name in cognito userinfo');
    }

    await this.userService.upsertFromCognito({
      email: normalizedEmail,
      nome,
      cognitoSub: userInfo.sub,
    });

    return { access_token: accessToken };
  }

  /**
   * Pega tokens via USER_PASSWORD_AUTH (Cognito API, não OAuth /oauth2/token).
   */
  private async getTokensWithUserPasswordAuth(
    email: string,
    password: string,
  ): Promise<CognitoTokenResponse> {
    const secretHash = this.getSecretHash(email);

    const cmd = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        ...(secretHash ? { SECRET_HASH: secretHash } : {}),
      },
    });

    const resp = await this.cognito.send(cmd);

    // Se houver challenge (ex: new password), trate aqui
    if (resp.ChallengeName) {
      // Exemplo comum: NEW_PASSWORD_REQUIRED
      throw new UnauthorizedException(
        `cognito login requires challenge: ${resp.ChallengeName}`,
      );

      // Se você quiser suportar NEW_PASSWORD_REQUIRED, eu monto o fluxo completo
      // com RespondToAuthChallenge e você me diz onde pegar a nova senha.
    }

    const auth = resp.AuthenticationResult;
    if (!auth?.AccessToken) {
      throw new UnauthorizedException(
        'cognito login failed: missing AccessToken',
      );
    }

    return {
      access_token: auth.AccessToken,
      id_token: auth.IdToken,
      refresh_token: auth.RefreshToken,
      expires_in: auth.ExpiresIn ?? 3600,
      token_type: 'Bearer',
    };
  }

  /**
   * Busca dados do usuário via Access Token (GetUser).
   * Isso substitui /oauth2/userInfo e funciona bem para backend.
   */
  private async getUserInfoFromCognito(
    accessToken: string,
  ): Promise<CognitoUserInfo> {
    try {
      const resp = await this.cognito.send(
        new GetUserCommand({
          AccessToken: accessToken,
        }),
      );

      const attrs = new Map(
        (resp.UserAttributes ?? []).map((a) => [a.Name, a.Value ?? '']),
      );

      const sub = attrs.get('sub') || '';
      const email = attrs.get('email') || '';
      const name =
        attrs.get('name') ||
        attrs.get('given_name') ||
        attrs.get('preferred_username') ||
        '';

      if (!sub) {
        throw new UnauthorizedException('cognito userinfo missing sub');
      }

      return { sub, email, name };
    } catch (e: any) {
      throw new UnauthorizedException(
        `cognito userinfo failed: ${e?.name || 'unknown_error'}`,
      );
    }
  }
}
