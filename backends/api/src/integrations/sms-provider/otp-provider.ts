export interface OtpMessage {
  destination: string;
  code: string;
  purpose: string;
  expiresInMinutes: number;
}

export interface OtpProvider {
  sendOtp(message: OtpMessage): Promise<void>;
}
