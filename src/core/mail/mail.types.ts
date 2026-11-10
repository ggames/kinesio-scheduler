export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailProvider {
  isEnabled(): boolean;
  send(message: MailMessage): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
