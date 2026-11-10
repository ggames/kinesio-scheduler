/**
 * Evento de dominio puro (POJO). No importa nada de NestJS.
 * Emitido por AppointmentsService tras un commit exitoso de reserva.
 */
export class TimeSlotCapacityUpdatedEvent {
  constructor(
    public readonly slotId: string,
    public readonly remainingCapacity: number,
    public readonly status: string,
  ) {}
}
