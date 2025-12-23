import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from '../entity/cliente.entity';

@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Cliente)
    private clienteRepository: Repository<Cliente>,
  ) {}

  async create(data: Partial<Cliente>) {
    const cliente = this.clienteRepository.create(data);
    const salvo = await this.clienteRepository.save(cliente);
    return {
      message: 'Cliente cadastrado com sucesso.',
      cliente: this.toSafeCliente(salvo),
    };
  }

  async findById(id: number) {
    const cliente = await this.clienteRepository.findOneBy({ id });
    return cliente ? this.toSafeCliente(cliente) : null;
  }

  async findByCpf(cpf: string) {
    const cliente = await this.clienteRepository.findOneBy({ cpf });
    return cliente ? this.toSafeCliente(cliente) : null;
  }

  /**
   * Retorno seguro: evita expor CPF completo em responses e logs.
   */
  private toSafeCliente(cliente: Cliente) {
    const cpf = cliente.cpf ?? '';
    const masked = cpf.length >= 4 ? `***.***.***-${cpf.slice(-2)}` : '***';
    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      cpfMasked: masked,
      createdAt: cliente.createdAt,
    };
  }
}
