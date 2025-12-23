import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { VendaService } from './service/venda.service';
import { ReservaCronService } from './service/reserva-cron.service';
import { VendaController } from './controller/venda.controller';
import { Cliente } from '../clientes/entity/cliente.entity';
import { Veiculo } from '../veiculos/entity/veiculo.entity';
import { VendaMicroserviceClient } from './service/venda-microservice.client';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Cliente, Veiculo])],
  controllers: [VendaController],
  providers: [VendaService, VendaMicroserviceClient, ReservaCronService],
})
export class VendaModule {}
