import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Veiculo, VeiculoStatus } from '../entity/veiculo.entity';

@Injectable()
export class VeiculoService {
  constructor(
    @InjectRepository(Veiculo)
    private veiculoRepo: Repository<Veiculo>,
  ) {}

  async criarVeiculo(data: Partial<Veiculo>) {
    const veiculo = this.veiculoRepo.create({
      ...data,
      status: VeiculoStatus.DISPONIVEL,
    });
    const salvo = await this.veiculoRepo.save(veiculo);
    return {
      message: 'Veículo cadastrado com sucesso.',
      veiculo: salvo,
    };
  }

  async editarVeiculo(id: number, data: Partial<Veiculo>) {
    const veiculo = await this.veiculoRepo.findOneBy({ id });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado');

    Object.assign(veiculo, data);
    const atualizado = await this.veiculoRepo.save(veiculo);
    return {
      message: 'Veículo atualizado com sucesso.',
      veiculo: atualizado,
    };
  }

  async listarDisponiveis() {
    return await this.veiculoRepo.find({
      where: { status: VeiculoStatus.DISPONIVEL },
      order: { preco: 'ASC' },
    });
  }

  async listarReservados() {
    return await this.veiculoRepo.find({
      where: { status: VeiculoStatus.RESERVADO },
      order: { preco: 'ASC' },
    });
  }

  async listarEntregues() {
    return await this.veiculoRepo.find({
      where: { status: VeiculoStatus.ENTREGUE },
      order: { preco: 'ASC' },
    });
  }

  async listarAguardandoPagamento() {
    return await this.veiculoRepo.find({
      where: { status: VeiculoStatus.AGUARDANDO_PAGAMENTO },
      order: { preco: 'ASC' },
    });
  }

  listarTodos() {
    return this.veiculoRepo.find({
      order: { preco: 'ASC' },
    });
  }
}
