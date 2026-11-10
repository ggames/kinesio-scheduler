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

export function renderActivationEmail(
  to: string,
  firstName: string,
  activationUrl: string,
  lang: Lang = 'es',
): MailMessage {
  const safeName = escapeHtml(firstName.trim() || 'profesional');
  const safeUrl = escapeHtml(activationUrl);
  const name = firstName.trim() || 'profesional';

  return {
    to,
    subject: t('activation.subject', lang),
    text: [
      t('activation.greeting', lang, { name }),
      '',
      t('activation.created', lang),
      t('activation.activate', lang),
      activationUrl,
      '',
      t('activation.expires', lang),
      t('activation.ignore', lang),
    ].join('\n'),
    html: [
      '<p>' + t('activation.greeting', lang, { name: safeName }) + '</p>',
      '<p>' + t('activation.created', lang) + '</p>',
      '<p>' + t('activation.activate', lang) + '</p>',
      '<p><a href="' + safeUrl + '">' + t('activation.button', lang) + '</a></p>',
      '<p>' + t('activation.expires', lang) + '</p>',
      '<p>' + t('activation.ignore', lang) + '</p>',
    ].join(''),
  };
}
