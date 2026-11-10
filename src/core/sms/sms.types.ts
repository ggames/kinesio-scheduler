export interface SmsMessage {
  to: string;
  text: string;
}

export interface SmsProvider {
  isEnabled(): boolean;
  send(message: SmsMessage): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
