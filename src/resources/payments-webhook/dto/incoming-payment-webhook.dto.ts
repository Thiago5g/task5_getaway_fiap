import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsISO8601,
} from 'class-validator';

export class IncomingPaymentWebhookDto {
  @IsString()
  eventId: string; // manter nome recebido externo e mapear internamente

  @IsString()
  paymentCode: string;

  @IsIn(['PAGO', 'CANCELADO', 'FALHOU', 'PENDENTE'])
  status: 'PAGO' | 'CANCELADO' | 'FALHOU' | 'PENDENTE';

  @IsOptional()
  @IsNumber()
  preco?: number; // centavos (opcional para CANCELADO)

  @IsIn(['BRL'])
  moeda: 'BRL';

  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
