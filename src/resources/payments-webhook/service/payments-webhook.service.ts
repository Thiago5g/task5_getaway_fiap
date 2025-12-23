import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncomingPaymentWebhookDto } from '../dto/incoming-payment-webhook.dto';
import { PaymentWebhookEvent } from '../entity/payment-webhook-event.entity';
import { Veiculo, VeiculoStatus } from '../../veiculos/entity/veiculo.entity';

@Injectable()
export class PaymentsWebhookService {
  private readonly logger = new Logger(PaymentsWebhookService.name);
  private salesServiceUrl = process.env.SALES_MS_URL || 'http://localhost:3001';

  constructor(
    @InjectRepository(PaymentWebhookEvent)
    private readonly repo: Repository<PaymentWebhookEvent>,
    @InjectRepository(Veiculo)
    private readonly veiculoRepo: Repository<Veiculo>,
    private readonly http: HttpService,
  ) {}

  private getInternalHeaders() {
    const token = process.env.SALES_INTERNAL_TOKEN;
    return token ? { 'x-internal-token': token } : {};
  }

  async handle(dto: IncomingPaymentWebhookDto) {
    const existing = await this.repo.findOne({
      where: { eventoId: dto.eventId },
    });
    if (existing) {
      this.logger.debug(`Duplicate event ${dto.eventId} ignored`);
      return { received: true, duplicate: true };
    }

    await this.repo.save({ eventoId: dto.eventId, dados: dto });

    try {
      // 1) Atualiza o pagamento no Sales MS pelo paymentCode (evita precisar do veiculoId no webhook)
      const salesPayload: any = {
        statusPagamento: dto.status,
      };
      if (dto.status === 'PAGO' && typeof dto.preco === 'number') {
        salesPayload.preco = dto.preco;
      }

      const salesResp = await this.http
        .patch(
          `${this.salesServiceUrl}/vendas/pagamento/${encodeURIComponent(dto.paymentCode)}`,
          salesPayload,
          {
            timeout: 5000,
            headers: this.getInternalHeaders(),
          },
        )
        .toPromise();

      // O Sales MS retorna normalmente { message, venda }
      const vendaAtualizada = salesResp?.data?.venda ?? salesResp?.data;
      const veiculoId = vendaAtualizada?.veiculoId;

      // 2) Compensações no Gateway (fonte da verdade do status do veículo)
      if (typeof veiculoId === 'number') {
        const veiculo = await this.veiculoRepo.findOne({ where: { id: veiculoId } });
        if (veiculo) {
          if (dto.status === 'PAGO') {
            veiculo.status = VeiculoStatus.AGUARDANDO_RETIRADA;
            await this.veiculoRepo.save(veiculo);
          }
          if (dto.status === 'CANCELADO' || dto.status === 'FALHOU') {
            veiculo.status = VeiculoStatus.DISPONIVEL;
            (veiculo as any).reservedByClienteId = null;
            (veiculo as any).reservedAt = null;
            (veiculo as any).reservationExpiresAt = null;
            await this.veiculoRepo.save(veiculo);
          }
        }
      } else {
        this.logger.warn(
          `Payment event ${dto.eventId}: Sales response sem veiculoId. Não foi possível ajustar status do veículo no Gateway.`,
        );
      }

      this.logger.log(
        `Processed payment event ${dto.eventId} status=${dto.status} paymentCode=${dto.paymentCode} -> Sales + compensações no Gateway`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed forwarding event ${dto.eventId}: ${err?.message || err}`,
      );
      // TODO: enqueue retry (BullMQ) if required
    }
    return { received: true };
  }
}
