export type Lang = 'es' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  'welcome.subject': {
    es: 'Bienvenido a Kinesiology Scheduler',
    en: 'Welcome to Kinesiology Scheduler',
  },
  'welcome.greeting': {
    es: 'Hola {{name}},',
    en: 'Hello {{name}},',
  },
  'welcome.accountCreated': {
    es: 'Tu cuenta fue creada exitosamente.',
    en: 'Your account was created successfully.',
  },
  'welcome.canBook': {
    es: 'Ya podés reservar turnos y consultar tu historial desde la aplicación.',
    en: 'You can now book appointments and check your history from the app.',
  },
  'welcome.thanks': {
    es: 'Gracias por confiar en nosotros.',
    en: 'Thank you for trusting us.',
  },
  'activation.subject': {
    es: 'Activá tu cuenta de Kinesiology Scheduler',
    en: 'Activate your Kinesiology Scheduler account',
  },
  'activation.greeting': {
    es: 'Hola {{name}},',
    en: 'Hello {{name}},',
  },
  'activation.created': {
    es: 'Tu cuenta profesional fue creada.',
    en: 'Your professional account was created.',
  },
  'activation.activate': {
    es: 'Para activarla y establecer tu contraseña, ingresá al siguiente enlace:',
    en: 'To activate it and set your password, go to the following link:',
  },
  'activation.expires': {
    es: 'El enlace vence en 24 horas.',
    en: 'The link expires in 24 hours.',
  },
  'activation.ignore': {
    es: 'Si no solicitaste esta cuenta, ignorá este mensaje.',
    en: 'If you did not request this account, ignore this message.',
  },
  'activation.button': {
    es: 'Activar mi cuenta',
    en: 'Activate my account',
  },
};

export function t(key: string, lang: Lang = 'es', params?: Record<string, string>): string {
  let text = translations[key]?.[lang] || translations[key]?.es || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), v);
    }
  }
  return text;
}
