import {
  Module,
  NestModule,
  MiddlewareConsumer,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { PaymentsWebhookController } from './controller/payments-webhook.controller';
import { PaymentsWebhookService } from './service/payments-webhook.service';
import { PaymentWebhookEvent } from './entity/payment-webhook-event.entity';
import { Veiculo } from '../veiculos/entity/veiculo.entity';
@Injectable()
export class SignatureMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const signature = req.headers['x-signature'] || req.headers['X-Signature'];
    if (!signature) {
      res.status(401).send('Missing signature header');
      return;
    }
    // TODO: verify the signature against your webhook secret/provider here
    next();
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([PaymentWebhookEvent, Veiculo]), HttpModule],
  controllers: [PaymentsWebhookController],
  providers: [PaymentsWebhookService],
})
export class PaymentsWebhookModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SignatureMiddleware).forRoutes('webhooks/payments');
  }
}
