import { MailMessage } from '../mail.types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderResetPasswordEmail(
  to: string,
  firstName: string,
  resetUrl: string,
): MailMessage {
  const safeName = escapeHtml(firstName.trim() || 'usuario');
  const safeUrl = escapeHtml(resetUrl);

  return {
    to,
    subject: 'Restablece tu contraseña',
    text: [
      `Hola ${firstName.trim() || 'usuario'},`,
      '',
      'Para restablecer tu contraseña, haz clic en el siguiente enlace:',
      resetUrl,
      '',
      'El enlace vence en 1 hora.',
      'Si no solicitaste este restablecimiento, ignora este mensaje.',
    ].join('\n'),
    html: [
      '<p>Hola ' + escapeHtml(safeName) + ',</p>',
      '<p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p>',
      '<p><a href="' + escapeHtml(safeUrl) + '">Restablecer contraseña</a></p>',
      '<p>El enlace vence en 1 hora.</p>',
      '<p>Si no solicitaste este restablecimiento, ignora este mensaje.</p>',
    ].join(''),
  };
}
