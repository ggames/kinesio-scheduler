import type { MailMessage } from '../mail.types';
import { t, type Lang } from './i18n';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderWelcomeEmail(
  to: string,
  firstName: string,
  lang: Lang = 'es',
): MailMessage {
  const safeName = escapeHtml(firstName.trim() || 'paciente');
  const name = firstName.trim() || 'paciente';

  return {
    to,
    subject: t('welcome.subject', lang),
    text: [
      t('welcome.greeting', lang, { name }),
      '',
      t('welcome.accountCreated', lang),
      t('welcome.canBook', lang),
      '',
      t('welcome.thanks', lang),
    ].join('\n'),
    html: [
      '<p>' + t('welcome.greeting', lang, { name: safeName }) + '</p>',
      '<p>' + t('welcome.accountCreated', lang) + '</p>',
      '<p>' + t('welcome.canBook', lang) + '</p>',
      '<p>' + t('welcome.thanks', lang) + '</p>',
    ].join(''),
  };
}
