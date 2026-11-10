import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from '../application/appointments.service';
import { CreateAppointmentDto } from '../application/dto/create-appointment.dto';
import {
  CancelAppointmentDto,
  CompleteAppointmentDto,
  FindAppointmentsQueryDto,
  RescheduleAppointmentDto,
} from '../application/dto/appointment-actions.dto';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ClinicScope } from '../../../core/auth/decorators/clinic-scope.decorator';
import { ADMIN, CLINIC_ADMIN, STAFF } from '../../../core/auth/roles';
import { IdempotencyService } from '../../../core/idempotency/idempotency.service';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get('my')
  @ApiOperation({ summary: 'Alias of /appointments/my-appointments' })
  findMyAlias(@Req() req: any) {
    const userId = req.user?.userId;
    return this.appointmentsService.findMyAppointments(userId);
  }

  @Get('my-appointments')
  @ApiOperation({
    summary: 'Get appointments for the logged-in user (as patient or professional)',
  })
  findMyAppointments(@Req() req: any) {
    const userId = req.user?.userId;
    return this.appointmentsService.findMyAppointments(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new appointment' })
  @ApiBody({ type: CreateAppointmentDto })
  create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.idempotencyService.execute({
      key: idempotencyKey,
      userId: req.user?.userId ?? 'anonymous',
      scope: 'appointments.create',
      payload: createAppointmentDto,
      successStatus: 201,
      action: () => this.appointmentsService.create(createAppointmentDto, req.user),
    });
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Get()
  @ApiOperation({ summary: 'Get all appointments' })
  findAll(
    @Query() query: FindAppointmentsQueryDto,
    @Req() req: any,
    @ClinicScope() clinicId: string | null,
  ) {
    return this.appointmentsService.findAll(query, req.user, clinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an appointment by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.appointmentsService.findOne(id, req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm an appointment' })
  confirm(@Param('id') id: string, @Req() req: any) {
    return this.appointmentsService.confirm(id, req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete an appointment and record the treatment session' })
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteAppointmentDto,
    @Req() req: any,
  ) {
    return this.appointmentsService.complete(id, dto, req.user);
  }

  @Roles(ADMIN, CLINIC_ADMIN, STAFF)
  @Patch(':id/no-show')
  @ApiOperation({ summary: 'Mark an appointment as no-show' })
  noShow(@Param('id') id: string, @Req() req: any) {
    return this.appointmentsService.noShow(id, req.user);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an appointment' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @Req() req: any,
  ) {
    return this.appointmentsService.cancel(id, dto, req.user);
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule an appointment to a new time slot' })
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
    @Req() req: any,
  ) {
    return this.appointmentsService.reschedule(id, dto, req.user);
  }
}
