import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentsGateway } from '../../../../core/websockets/appointments.gateway';
import { TimeSlotCapacityUpdatedEvent } from '../../domain/events/time-slot-capacity-updated.event';

/**
 * Listener que actúa como adaptador entre el bus de eventos de dominio
 * y la capa de transporte WebSocket.
 *
 * El AppointmentsService no conoce este componente, solo emite al bus.
 * Esto preserva la separación entre casos de uso y transporte.
 */
@Injectable()
export class SlotCapacityListener {
  constructor(private readonly gateway: AppointmentsGateway) {}

  @OnEvent('slot.capacity.updated')
  handleSlotCapacityUpdated(event: TimeSlotCapacityUpdatedEvent) {
    this.gateway.emitCapacityUpdate({
      slotId: event.slotId,
      remainingCapacity: event.remainingCapacity,
      status: event.status,
    });
  }
}
