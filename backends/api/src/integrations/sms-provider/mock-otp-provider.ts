import { config } from "../../config.js";
import type { OtpMessage, OtpProvider } from "./otp-provider.js";

export class MockOtpProvider implements OtpProvider {
  async sendOtp(message: OtpMessage): Promise<void> {
    if (config.NODE_ENV !== "production") {
      console.info(`[MockOtpProvider] ${message.purpose} OTP for ${message.destination}: ${message.code} (expires in ${message.expiresInMinutes} minutes)`);
    }
  }
}
