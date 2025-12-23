import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cliente } from '../../clientes/entity/cliente.entity';
import { VeiculoStatus, Veiculo } from '../../veiculos/entity/veiculo.entity';
import { VendaMicroserviceClient } from './venda-microservice.client';

@Injectable()
export class VendaService {
  constructor(
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(Veiculo) private veiculoRepo: Repository<Veiculo>,
    private externalClient: VendaMicroserviceClient,
  ) {}

  async realizarVenda(cpf: string, placa: string, preco: number): Promise<any> {
    const cliente = await this.clienteRepo.findOneBy({ cpf });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    const veiculo = await this.veiculoRepo.findOne({ where: { placa } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado');
    if (
      veiculo.status !== VeiculoStatus.RESERVADO &&
      veiculo.status !== VeiculoStatus.DISPONIVEL
    )
      throw new BadRequestException('Veículo já foi vendido');

    const external = await this.externalClient.registrarVenda({
      clienteId: cliente.id,
      veiculoId: veiculo.id,
      preco,
    });

    // Atualiza status somente se microserviço confirmar sucesso
    if (external && (external as any).success !== false) {
      veiculo.status = VeiculoStatus.AGUARDANDO_PAGAMENTO;
      await this.veiculoRepo.save(veiculo);
    }

    return {
      message:
        external && (external as any).success === false
          ? 'Venda registrada parcialmente: microserviço não confirmou sucesso.'
          : 'Venda efetuada com sucesso via microserviço.',
      preco,
      cliente: { id: cliente.id, cpf: cliente.cpf },
      veiculo: {
        id: veiculo.id,
        placa: (veiculo as any).placa,
        status: veiculo.status,
      },
      external,
    };
  }

  async listarVendas(): Promise<any[]> {
    const vendas = await this.externalClient.listVendas();
    if (!Array.isArray(vendas)) return [];
    // Enriquecer cada venda com veículo e cliente (assume que venda tem veiculoId/clienteId)
    const enriched = await Promise.all(
      vendas.map(async (v: any) => {
        const veiculo = v.veiculoId
          ? await this.veiculoRepo.findOne({ where: { id: v.veiculoId } })
          : null;
        const cliente = v.clienteId
          ? await this.clienteRepo.findOne({ where: { id: v.clienteId } })
          : null;
        return { ...v, veiculo, cliente };
      }),
    );
    return enriched;
  }

  async obterVendaPorPlaca(placa: string): Promise<any> {
    const veiculo = await this.veiculoRepo.findOne({ where: { placa } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado');
    const venda = await this.externalClient.getVendaPorVeiculo(veiculo.id);
    if (!venda)
      throw new NotFoundException('Venda não encontrada para veículo');
    const cliente = venda.clienteId
      ? await this.clienteRepo.findOne({ where: { id: venda.clienteId } })
      : null;
    return { ...venda, veiculo, cliente };
  }

  async realizarReserva(placa: string): Promise<any> {
    // Compatível com chamada existente; se quiser associar cliente à reserva,
    // use o novo método realizarReservaComCpf(...)
    const veiculo = await this.veiculoRepo.findOne({ where: { placa } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado');
    if (veiculo.status === VeiculoStatus.RESERVADO)
      throw new BadRequestException('Veículo já foi reservado');
    if (veiculo.status !== VeiculoStatus.DISPONIVEL)
      throw new BadRequestException(
        'Veículo já foi vendido ou não está disponível',
      );

    veiculo.status = VeiculoStatus.RESERVADO;
    veiculo.reservedAt = new Date();
    veiculo.reservationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await this.veiculoRepo.save(veiculo);

    return {
      message: 'Reserva do veiculo efetuado com sucesso',

      veiculo: {
        id: veiculo.id,
        placa: (veiculo as any).placa,
        status: veiculo.status,
      },
    };
  }

  async realizarReservaComCpf(placa: string, cpf?: string): Promise<any> {
    if (!cpf) {
      return this.realizarReserva(placa);
    }
    const cliente = await this.clienteRepo.findOneBy({ cpf });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    const veiculo = await this.veiculoRepo.findOne({ where: { placa } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado');
    if (veiculo.status === VeiculoStatus.RESERVADO)
      throw new BadRequestException('Veículo já foi reservado');
    if (veiculo.status !== VeiculoStatus.DISPONIVEL)
      throw new BadRequestException(
        'Veículo já foi vendido ou não está disponível',
      );

    veiculo.status = VeiculoStatus.RESERVADO;
    veiculo.reservedByClienteId = cliente.id;
    veiculo.reservedAt = new Date();
    veiculo.reservationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await this.veiculoRepo.save(veiculo);

    return {
      message: 'Reserva do veiculo efetuado com sucesso',
      veiculo: {
        id: veiculo.id,
        placa: (veiculo as any).placa,
        status: veiculo.status,
      },
      reserva: {
        reservedByClienteId: veiculo.reservedByClienteId,
        reservedAt: veiculo.reservedAt,
        reservationExpiresAt: veiculo.reservationExpiresAt,
      },
    };
  }

  async cancelamentoReserva(placa: string): Promise<any> {
    const veiculo = await this.veiculoRepo.findOne({ where: { placa } });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado');
    veiculo.status = VeiculoStatus.DISPONIVEL;
    veiculo.reservedByClienteId = null;
    veiculo.reservedAt = null;
    veiculo.reservationExpiresAt = null;
    await this.veiculoRepo.save(veiculo);

    return {
      message: 'Cancelamento de reserva efetuado com sucesso',

      veiculo: {
        id: veiculo.id,
        placa: (veiculo as any).placa,
        status: veiculo.status,
      },
    };
  }

  async expiracaoReserva(): Promise<any> {
    // Expira reservas com base em reservationExpiresAt (mais confiável do que updatedAt)
    const cutoff = new Date();
    const expirados = await this.veiculoRepo.find({
      where: {
        status: VeiculoStatus.RESERVADO,
        reservationExpiresAt: LessThan(cutoff),
      },
    });
    for (const veiculo of expirados) {
      veiculo.status = VeiculoStatus.DISPONIVEL;
      veiculo.reservedByClienteId = null;
      veiculo.reservedAt = null;
      veiculo.reservationExpiresAt = null;
      await this.veiculoRepo.save(veiculo);
    }
    return {
      message: 'Expiração de reservas processada com sucesso',
      veiculosAtualizados: expirados.length,
    };
  }

  async realizarRetirada(placa: string): Promise<any> {
    const veiculo = await this.veiculoRepo.findOne({
      where: { placa },
    });
    if (!veiculo) throw new NotFoundException('Veículo não encontrado');
    if (veiculo.status === VeiculoStatus.ENTREGUE)
      throw new BadRequestException('Veículo já foi entregue');

    if (veiculo.status !== VeiculoStatus.AGUARDANDO_RETIRADA) {
      throw new BadRequestException(
        'Retirada não permitida: pagamento ainda não confirmado',
      );
    }

    const external = await this.externalClient.registrarRetirada(veiculo.id);

    // Atualiza status somente se microserviço confirmar sucesso
    if (external && (external as any).success !== false) {
      veiculo.status = VeiculoStatus.ENTREGUE;
      await this.veiculoRepo.save(veiculo);
    }

    return {
      message:
        external && (external as any).success === false
          ? 'Retirada registrada parcialmente: microserviço não confirmou sucesso.'
          : 'Retirada efetuada com sucesso via microserviço.',
      statusVeiculo: VeiculoStatus.ENTREGUE,
      external,
    };
  }
}
