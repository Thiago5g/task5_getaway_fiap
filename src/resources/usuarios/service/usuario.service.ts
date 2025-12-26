import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../entity/usuario.entity';

type UpsertFromCognitoInput = {
  email: string;
  nome: string;
  cognitoSub?: string; // só se existir na entity/tabela
};

@Injectable()
export class UsuarioService {
  constructor(
    @InjectRepository(Usuario)
    private readonly userRepo: Repository<Usuario>,
  ) {}

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<Usuario | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async upsertFromCognito(input: UpsertFromCognitoInput): Promise<any> {
    const email = input.email.trim().toLowerCase();
    const nome = input.nome.trim();

    const existing = await this.findByEmail(email);

    if (!existing) {
      const user = this.userRepo.create({
        email,
        nome,
        // ⚠️ password não deve ser usado com Cognito.
        // Se sua coluna password for NOT NULL, veja observação abaixo.
        ...(typeof (input as any).cognitoSub === 'string'
          ? { cognitoSub: input.cognitoSub }
          : {}),
      } as any);

      return this.userRepo.save(user);
    }

    const changed =
      existing.nome !== nome ||
      (typeof (existing as any).cognitoSub === 'string' &&
        input.cognitoSub &&
        (existing as any).cognitoSub !== input.cognitoSub);

    if (!changed) return existing;

    existing.nome = nome;
    if (input.cognitoSub) {
      (existing as any).cognitoSub = input.cognitoSub;
    }

    return this.userRepo.save(existing);
  }
}
