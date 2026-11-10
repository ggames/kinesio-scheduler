import { Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterProfessionalDto } from './dto/register-professional.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { ADMIN } from './roles';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @RateLimit({ limit: 5, ttlMs: 60_000 })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login público con email y contraseña para obtener token JWT' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Retorna access_token JWT.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas o cuenta pendiente/inactiva.' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @RateLimit({ limit: 5, ttlMs: 60_000 })
  @Post('register-patient')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registro público de paciente: Crea cuenta de usuario y perfil de paciente en una transacción atómica',
  })
  @ApiBody({ type: RegisterPatientDto })
  @ApiResponse({ status: 201, description: 'Usuario y Paciente creados exitosamente.' })
  @ApiResponse({ status: 409, description: 'Email o documento ya registrados.' })
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  /** Alias para soporte de endpoints de registro genéricos */
  @Public()
  @RateLimit({ limit: 5, ttlMs: 60_000 })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Alias para registro público de paciente' })
  @ApiBody({ type: RegisterPatientDto })
  register(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  @Roles(ADMIN)
  @ApiBearerAuth()
  @RateLimit({ limit: 10, ttlMs: 60_000 })
  @Post('register-professional')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registro de profesional (Admin): Crea perfil profesional en estado PENDING y envía enlace de activación',
  })
  @ApiBody({ type: RegisterProfessionalDto })
  @ApiResponse({ status: 201, description: 'Profesional creado con estado PENDING.' })
  @ApiResponse({ status: 409, description: 'Email, documento o matrícula ya registrados.' })
  registerProfessional(@Body() dto: RegisterProfessionalDto, @Req() req: any) {
    return this.authService.registerProfessional(dto, req.user?.userId);
  }

  @Public()
  @RateLimit({ limit: 5, ttlMs: 60_000 })
  @Post('activate-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activación de cuenta: Establece la contraseña y activa la cuenta',
  })
  @ApiBody({ type: ActivateAccountDto })
  @ApiResponse({ status: 200, description: 'Cuenta activada exitosamente. Retorna JWT.' })
  @ApiResponse({ status: 400, description: 'Token de activación inválido o expirado.' })
  activateAccount(@Body() dto: ActivateAccountDto) {
    return this.authService.activateAccount(dto);
  }

  @Public()
  @RateLimit({ limit: 10, ttlMs: 60_000 })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotar refresh token y emitir un nuevo access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Retorna un nuevo access_token y refresh_token.' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido, expirado o reutilizado.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @RateLimit({ limit: 10, ttlMs: 60_000 })
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alias de /auth/refresh' })
  @ApiBody({ type: RefreshTokenDto })
  refreshAlias(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión e invalidar access y refresh token' })
  @ApiBody({ type: LogoutDto, required: false })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente.' })
  async logout(@Req() req: any, @Body() dto: LogoutDto) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await this.authService.logout(token, dto?.refresh_token, req.user?.userId);
    }
    return { message: 'Logged out successfully.' };
  }

  @ApiBearerAuth()
  @RateLimit({ limit: 5, ttlMs: 60_000 })
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar todas las sesiones del usuario' })
  logoutAll(@Req() req: any) {
    return this.authService.logoutAll(req.user.userId);
  }

  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @ApiBearerAuth()
  @Patch('profile')
  @ApiOperation({ summary: 'Actualizar perfil del usuario autenticado' })
  @ApiBody({ type: UpdateProfileDto })
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.userId, dto);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada exitosamente' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta' })
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, dto);
  }

  @Public()
  @RateLimit({ limit: 5, ttlMs: 60_000 })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar restablecimiento de contraseña (envía token por email)' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Correo de restablecimiento enviado' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @RateLimit({ limit: 10, ttlMs: 60_000 })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña usando token y nueva contraseña' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Contraseña restablecida exitosamente' })
  @ApiResponse({ status: 400, description: 'Token inválido, expirado o usado' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
