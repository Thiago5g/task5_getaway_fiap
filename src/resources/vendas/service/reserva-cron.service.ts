import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VendaService } from './venda.service';

@Injectable()
export class ReservaCronService {
  private readonly logger = new Logger(ReservaCronService.name);

  constructor(private readonly vendaService: VendaService) {}

  // Executa a cada 1 minuto
  @Cron(CronExpression.EVERY_MINUTE)
  async handleReservaExpiration() {
    try {
      this.logger.debug('Executando verificação de expiração de reservas...');
      await this.vendaService.expiracaoReserva();
    } catch (err) {
      this.logger.error('Erro ao processar expiração de reservas', err as any);
    }
  }
}
