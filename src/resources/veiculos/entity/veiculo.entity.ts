// entity/veiculo.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum VeiculoStatus {
  DISPONIVEL = 'DISPONIVEL',
  RESERVADO = 'RESERVADO',
  AGUARDANDO_PAGAMENTO = 'AGUARDANDO_PAGAMENTO',
  AGUARDANDO_RETIRADA = 'AGUARDANDO_RETIRADA',
  ENTREGUE = 'ENTREGUE',
}

@Entity('veiculos')
export class Veiculo {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  marca: string;

  @Column()
  @ApiProperty()
  modelo: string;

  @Column({ nullable: true, unique: true })
  @ApiProperty({ example: 'ABC1D23', description: 'Placa do veículo' })
  placa: string;

  @Column()
  @ApiProperty()
  ano: number;

  @Column()
  @ApiProperty()
  cor: string;

  @Column('numeric')
  @ApiProperty()
  preco: number;

  @Column({ type: 'enum', enum: VeiculoStatus })
  @ApiProperty({ enum: VeiculoStatus })
  status: VeiculoStatus;

  // --- Metadados de reserva (opcional, mas ajuda no controle de expiração e auditoria) ---
  @Column({ name: 'reserved_by_cliente_id', type: 'int', nullable: true })
  @ApiProperty({ required: false, description: 'ID do cliente que reservou' })
  reservedByClienteId?: number | null;

  @Column({ name: 'reserved_at', type: 'timestamptz', nullable: true })
  @ApiProperty({ required: false, description: 'Data/hora da reserva' })
  reservedAt?: Date | null;

  @Column({ name: 'reservation_expires_at', type: 'timestamptz', nullable: true })
  @ApiProperty({
    required: false,
    description: 'Data/hora de expiração da reserva (ex.: reservedAt + 48h)',
  })
  reservationExpiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty()
  updatedAt: Date;
}
