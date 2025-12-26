import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { VendaService } from '../service/venda.service';
import { CreateVendaDto } from '../dto/create-venda.dto';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
// Endpoints de vendas/reservas lidam com dados sensíveis e transições críticas.
// Mantemos protegidos pelo JwtAuthGuard global (ver AppModule). O único público deve ser o webhook.

@ApiTags('Vendas')
@Controller('vendas')
export class VendaController {
  constructor(private readonly vendaService: VendaService) {}

  @Post(':placa/reservar')
  @ApiOperation({ summary: 'Realizar uma reserva delegando ao microserviço' })
  @ApiBody({ type: CreateVendaDto })
  @UseGuards(RolesGuard)
  @Roles('Operators', 'Admins')
  reservar(
    @Param('placa') placa: string,
    @Body() body: Partial<CreateVendaDto>,
  ): Promise<any> {
    // CPF é opcional para manter compatibilidade com chamadas existentes.
    return this.vendaService.realizarReservaComCpf(placa, body?.cpf);
  }

  @Post(':placa/cancelamento-reserva')
  @ApiOperation({
    summary: 'Realizar um cancelamento de reserva delegando ao microserviço',
  })
  @ApiBody({ type: CreateVendaDto })
  @UseGuards(RolesGuard)
  @Roles('Operators', 'Admins')
  cancelamentoReserva(@Param('placa') placa: string): Promise<any> {
    return this.vendaService.cancelamentoReserva(placa);
  }

  @Post('efetuar-venda')
  @ApiOperation({ summary: 'Realizar uma venda delegando ao microserviço' })
  @ApiBody({ type: CreateVendaDto })
  @UseGuards(RolesGuard)
  @Roles('Operators', 'Admins')
  vender(@Body() body: CreateVendaDto): Promise<any> {
    const { cpf, placa, preco } = body;
    return this.vendaService.realizarVenda(cpf, placa, preco);
  }

  @Post(':placa/retirar')
  @ApiOperation({ summary: 'Realizar uma retirada delegando ao microserviço' })
  @ApiBody({ type: CreateVendaDto })
  @UseGuards(RolesGuard)
  @Roles('Operators', 'Admins')
  retirar(@Param('placa') placa: string): Promise<any> {
    return this.vendaService.realizarRetirada(placa);
  }

  @Get()
  @ApiOperation({ summary: 'Listar vendas (microserviço) enriquecidas' })
  listar(): Promise<any[]> {
    return this.vendaService.listarVendas();
  }

  @Get('placa/:placa')
  @ApiOperation({ summary: 'Obter venda por placa do veículo' })
  @ApiParam({ name: 'placa', example: 'ABC1D23' })
  obterPorPlaca(@Param('placa') placa: string): Promise<any> {
    return this.vendaService.obterVendaPorPlaca(placa);
  }
}
