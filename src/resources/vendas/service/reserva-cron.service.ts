import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { VendaService } from './venda.service';

@Injectable()
export class ReservaCronService {
  private readonly logger = new Logger(ReservaCronService.name);

  constructor(
    private readonly vendaService: VendaService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    // Agenda dinamicamente a cron baseada em minutos definidos no .env
    const minutesRaw = this.configService.get<string>('RESERVA_CRON_MINUTES');
    const minutes = parseInt(minutesRaw ?? '10', 10);
    const interval = Number.isFinite(minutes) && minutes > 0 ? minutes : 10;
    const expression = `*/${interval} * * * *`;

    const job = new CronJob(expression, async () => {
      await this.handleReservaExpiration();
    });

    try {
      this.schedulerRegistry.addCronJob('reserva-expiration', job);
      job.start();
      this.logger.log(
        `Reserva cron agendada para cada ${interval} minuto(s) (expr: ${expression})`,
      );
    } catch (err) {
      this.logger.error('Falha ao agendar cron de reservas', err as any);
    }
  }

  // Corpo da tarefa executada quando a cron dispara
  async handleReservaExpiration() {
    try {
      this.logger.debug('Executando verificação de expiração de reservas...');
      await this.vendaService.expiracaoReserva();
    } catch (err) {
      this.logger.error('Erro ao processar expiração de reservas', err as any);
    }
  }
}
